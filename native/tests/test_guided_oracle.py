from guided_model import forcing, oracle


def test_four_scenarios_close_water_and_keep_target_fixed():
    f = forcing()
    cases = {(m, d): oracle(f, m, d, 0, 365) for m in (False, True) for d in (False, True)}
    for rows in cases.values():
        assert all(r["residualL"] == 0 for r in rows)
        assert [r["ecologicalL"] for r in rows] == f["ecologicalL"]
        assert all(r["issuedL"] <= r["deliverableL"] for r in rows)
    assert any(r["storageL"] > 0 for r in cases[True, False])
    assert any(r["C1L"] > 0 for r in cases[True, False])
    assert any(r["R2bL"] < r["ecologicalL"] for r in cases[True, True])


def test_chunk_handoff_oracle_preserves_storage_and_absolute_season():
    f = forcing()
    whole = oracle(f, True, False, 150, 156)
    first = oracle(f, True, False, 150, 153)
    second = oracle(f, True, False, 153, 156, first[-1]["storageL"])
    assert whole == first + second
