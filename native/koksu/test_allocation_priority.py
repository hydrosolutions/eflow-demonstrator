from dataclasses import replace
from datetime import date, timedelta
from fractions import Fraction
import pytest
from native_contracts import Candidate, Forcing, Policy
from native_comparison import simulate, independent_ledger, water_m3


def case(boundary=(200_000,), target=76_000, request=152_000, storage=0, capacity=5_000_000_000):
    n = len(boundary)
    forcing = Forcing(2011, tuple(date(2011, 1, 1)+timedelta(days=i) for i in range(n)), boundary, (request,)*n, 'witness-input')
    candidate = Candidate('swiss', 2011, (Fraction(target,86_400_000),)*n, (target,)*n, 'witness', 'witness-target', {'basis':'hypothetical'})
    return forcing, candidate, Policy(initial_storage_litres=storage, capacity_litres=capacity)


def test_native_priority_witness_preserves_shared_instruction_and_return_masking(tmp_path):
    f,c,p = case()
    eco = simulate(f,c,p,tmp_path/'eco',chunk_days=1)
    irr = simulate(f,c,replace(p,priority='irrigation-first'),tmp_path/'irr',chunk_days=1)
    a,b=eco.ledger[0],irr.ledger[0]
    assert (a.diversion_litres,a.r2a_litres,a.downstream_litres)==(114000,76000,133000)
    assert (b.diversion_litres,b.r2a_litres,b.downstream_litres)==(152000,38000,114000)
    assert a.issued_litres==b.issued_litres==76000
    for kind in ('candidate','issued'):
        assert eco.r2a_fishy_assessment[kind]['rawFishy']==['pass']
        assert irr.r2a_fishy_assessment[kind]['rawFishy']==['fail']
        assert eco.fishy_assessment[kind]['rawFishy']==irr.fishy_assessment[kind]['rawFishy']==['pass']
        assert irr.r2a_fishy_assessment[kind]['shortfallVolumeM3']==38


def test_ecology_priority_reserves_target_without_twenty_percent_cap(tmp_path):
    f,c,p=case()
    row=simulate(f,c,p,tmp_path,1).ledger[0]
    assert row.diversion_litres==114000 > (row.boundary_litres-row.natural_loss_litres)*.2
    assert row.request_litres==152000
    assert row.r2a_litres==row.candidate_litres


def test_irrigation_priority_serves_request_without_twenty_percent_cap(tmp_path):
    f,c,p=case()
    p=replace(p,priority='irrigation-first')
    low=simulate(f,c,p,tmp_path/'low',1)
    high=simulate(f,replace(c,target_litres=(190000,),raw_m3s=(Fraction(190000,86400000),)),p,tmp_path/'high',1)
    assert low.ledger[0].diversion_litres==high.ledger[0].diversion_litres==152000
    assert low.ledger[0].r2a_litres==38000


def test_reservoir_aims_before_return_and_retains_unavoidable_spill(tmp_path):
    f,c,p=case(storage=200000,capacity=200000)
    row=simulate(f,c,p,tmp_path,1).ledger[0]
    assert (row.spill_litres,row.release_litres,row.r2a_litres,row.return_litres)==(76000,0,76000,57000)
    assert row.downstream_litres==133000 and row.end_storage_litres==200000


def test_stock_can_buffer_shortfall_but_does_not_redefine_instruction(tmp_path):
    f,c,p=case(boundary=(0,0),storage=60000)
    r=simulate(f,c,p,tmp_path,1)
    assert [x.r2a_litres for x in r.ledger]==[60000,0]
    assert [x.issued_litres for x in r.ledger]==[0,0]
    assert r.r2a_fishy_assessment['candidate']['rawFishy']==['fail','fail']
    assert r.r2a_fishy_assessment['issued']['rawFishy']==['pass','pass']


def test_zero_input_stock_and_requests_remain_known_zero(tmp_path):
    f,c,p=case(boundary=(0,0),target=0,request=0)
    r=simulate(f,c,p,tmp_path,1)
    assert all(x.downstream_litres==x.r2a_litres==x.end_storage_litres==x.residual_litres==0 for x in r.ledger)
    assert r.r2a_fishy_assessment['candidate']['rawFishy']==['pass','pass']


def test_native_continuous_chunked_and_canonical_storage_agree(tmp_path):
    f,c,p=case(boundary=(171072000,171072000,0,342144000,171072000,0),target=55080000,request=100000000,storage=2835616800)
    for priority in ('ecology-first','irrigation-first'):
        rule=replace(p,priority=priority)
        a=simulate(f,c,rule,tmp_path/priority/'whole',6)
        b=simulate(f,c,rule,tmp_path/priority/'chunks',3)
        assert a.ledger==b.ledger==independent_ledger(f,c,rule,True)
        assert a.fishy_assessment==b.fishy_assessment
        assert a.r2a_fishy_assessment==b.r2a_fishy_assessment
        assert all(x['maxTransitStorageLitres']==0 for x in b.chunks)
    assert water_m3(2835616800)!=2835616800/1000
    for bad in (-1,True,1.5,2**53+1):
        with pytest.raises(ValueError,match='water count must be a nonnegative integer'):
            water_m3(bad)


def test_priorities_close_daily_and_annual_water_balance(tmp_path):
    f,c,p=case(boundary=(200000,0,400000,0),storage=60000,capacity=200000)
    results=[simulate(f,c,replace(p,priority=q),tmp_path/q,3) for q in ('ecology-first','irrigation-first')]
    for r in results:
        for x in r.ledger:
            assert x.boundary_litres+x.start_storage_litres==x.natural_loss_litres+x.consumption_litres+x.downstream_litres+x.end_storage_litres
            assert x.downstream_litres==x.r2a_litres+x.return_litres
    a,b=results
    assert sum(y.downstream_litres-x.downstream_litres for x,y in zip(a.ledger,b.ledger))==-sum(y.consumption_litres-x.consumption_litres for x,y in zip(a.ledger,b.ledger))-(b.ledger[-1].end_storage_litres-a.ledger[-1].end_storage_litres)


def test_priority_instruction_is_source_based_for_all_candidate_modes(tmp_path):
    f,c,p=case(boundary=(200000,40000))
    for target in (76000,152000):
        cand=replace(c,target_litres=(target,)*2,raw_m3s=(Fraction(target,86400000),)*2)
        for priority in ('ecology-first','irrigation-first'):
            r=simulate(f,cand,replace(p,priority=priority),tmp_path/f'{priority}-{target}',2)
            assert [x.issued_litres for x in r.ledger]==[min(target,190000),38000]
            for assessment,field in ((r.fishy_assessment,'downstream_litres'),(r.r2a_fishy_assessment,'r2a_litres')):
                for kind,key in (('candidate','candidate_litres'),('issued','issued_litres')):
                    deficits=[max(0,getattr(x,key)-getattr(x,field)) for x in r.ledger]
                    assert assessment[kind]['rawFishy']==['fail' if d else 'pass' for d in deficits]
                    assert assessment[kind]['shortfallVolumeM3']==sum(deficits)/1000
                    assert assessment[kind]['applicability']=='hypothetical'
