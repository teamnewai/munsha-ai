"""B3 unit tests — D3 Selection Engine.

Covers: regime classification + direction gate, Core & Turbo eligibility
gates, deterministic /100 scoring, classification bands, ranking, and
determinism. Pure / offline (no DB / network).
"""

import unittest
from dataclasses import replace
from decimal import Decimal

from src.enums import Direction, EngineType, MarketRegime, TradeClassification
from src.selection import (
    BreakoutFacts,
    CoreCandidateInput,
    CoreScanner,
    EarningsFacts,
    MarketFacts,
    MarketRegimeEngine,
    RankingEngine,
    ScoredCandidate,
    SelectionEngine,
    TradeClassificationEngine,
    TurboCandidateInput,
    TurboScanner,
    classify_score,
)

D = Decimal


# --------------------------------------------------------------------------- #
# builders
# --------------------------------------------------------------------------- #
def market(kind="bull") -> MarketFacts:
    if kind == "bull":
        return MarketFacts(spy_price=D("110"), spy_sma_200=D("100"))
    if kind == "bear":
        return MarketFacts(spy_price=D("90"), spy_sma_200=D("100"))
    return MarketFacts(spy_price=D("100"), spy_sma_200=D("100"))  # sideways


def core_full(**over) -> CoreCandidateInput:
    base = CoreCandidateInput(
        symbol="AAA", direction=Direction.LONG, rs_rating=D("95"),
        rvol=D("2.5"), adv=1_000_000, trend_stage2=True,
        breakout=BreakoutFacts(new_52w_high=True),
        earnings=EarningsFacts(surprise_positive=True, days_since=3, aligned=True),
    )
    return replace(base, **over)


def turbo_full(**over) -> TurboCandidateInput:
    base = TurboCandidateInput(
        symbol="TTT", direction=Direction.LONG, rvol=D("3.5"), adv=1_000_000,
        atr=D("0.8"), premarket_volume=200_000, gap_pct=D("0.06"),
        above_vwap=True, catalyst=True, orb_confirmed=True, momentum_ok=True,
    )
    return replace(base, **over)


# --------------------------------------------------------------------------- #
class TestRegime(unittest.TestCase):
    def setUp(self):
        self.eng = MarketRegimeEngine()

    def test_bull(self):
        self.assertEqual(self.eng.evaluate(market("bull")), MarketRegime.BULL)

    def test_bear(self):
        self.assertEqual(self.eng.evaluate(market("bear")), MarketRegime.BEAR)

    def test_sideways_within_band(self):
        self.assertEqual(self.eng.evaluate(market("sideways")), MarketRegime.SIDEWAYS)

    def test_gate(self):
        self.assertTrue(self.eng.allows(MarketRegime.BULL, Direction.LONG))
        self.assertFalse(self.eng.allows(MarketRegime.BEAR, Direction.LONG))
        self.assertTrue(self.eng.allows(MarketRegime.BEAR, Direction.SHORT))
        self.assertFalse(self.eng.allows(MarketRegime.BULL, Direction.SHORT))
        self.assertFalse(self.eng.allows(MarketRegime.SIDEWAYS, Direction.LONG))
        self.assertFalse(self.eng.allows(MarketRegime.SIDEWAYS, Direction.SHORT))


class TestCoreScoring(unittest.TestCase):
    def setUp(self):
        self.scanner = CoreScanner()
        self.regime = MarketRegime.BULL

    def test_full_is_100_ultragolden(self):
        r = self.scanner.evaluate(self.regime, core_full())
        self.assertEqual(r.score, D("100"))
        self.assertEqual(r.classification, TradeClassification.ULTRA_GOLDEN)
        self.assertEqual(r.engine, EngineType.CORE)

    def test_no_pead_is_90_strong(self):
        r = self.scanner.evaluate(self.regime, core_full(earnings=None))
        self.assertEqual(r.score, D("90"))
        self.assertEqual(r.classification, TradeClassification.STRONG)

    def test_golden_band(self):
        # RS>=90, new high, RVOL base (1.5..2.0), trend, PEAD -> 95.5
        r = self.scanner.evaluate(self.regime, core_full(rvol=D("1.6")))
        self.assertEqual(r.score, D("95.5"))
        self.assertEqual(r.classification, TradeClassification.GOLDEN)

    def test_watchlist_band(self):
        # RS base(14), base breakout(14), RVOL base(10.5), no PEAD -> 73.5
        r = self.scanner.evaluate(self.regime, core_full(
            rs_rating=D("82"), rvol=D("1.6"),
            breakout=BreakoutFacts(base_breakout=True, base_days=60),
            earnings=None,
        ))
        self.assertEqual(r.score, D("73.5"))
        self.assertEqual(r.classification, TradeClassification.WATCHLIST)

    def test_base_breakout_below_50_days_dropped(self):
        r = self.scanner.evaluate(self.regime, core_full(
            breakout=BreakoutFacts(base_breakout=True, base_days=40)))
        self.assertIsNone(r)


class TestCoreGates(unittest.TestCase):
    def setUp(self):
        self.scanner = CoreScanner()

    def test_rs_below_80_dropped(self):
        self.assertIsNone(self.scanner.evaluate(MarketRegime.BULL, core_full(rs_rating=D("79"))))

    def test_rvol_below_min_dropped(self):
        self.assertIsNone(self.scanner.evaluate(MarketRegime.BULL, core_full(rvol=D("1.4"))))

    def test_trend_false_dropped(self):
        self.assertIsNone(self.scanner.evaluate(MarketRegime.BULL, core_full(trend_stage2=False)))

    def test_no_breakout_dropped(self):
        self.assertIsNone(self.scanner.evaluate(MarketRegime.BULL, core_full(breakout=BreakoutFacts())))

    def test_low_liquidity_dropped(self):
        self.assertIsNone(self.scanner.evaluate(MarketRegime.BULL, core_full(adv=100_000)))

    def test_long_in_bear_dropped(self):
        self.assertIsNone(self.scanner.evaluate(MarketRegime.BEAR, core_full()))

    def test_short_core_candidate_dropped(self):
        self.assertIsNone(self.scanner.evaluate(MarketRegime.BULL, core_full(direction=Direction.SHORT)))


class TestTurboScoring(unittest.TestCase):
    def setUp(self):
        self.scanner = TurboScanner()

    def test_full_is_100(self):
        r = self.scanner.evaluate(MarketRegime.BULL, turbo_full())
        self.assertEqual(r.score, D("100"))
        self.assertEqual(r.classification, TradeClassification.ULTRA_GOLDEN)
        self.assertEqual(r.engine, EngineType.TURBO)

    def test_no_catalyst_is_94_strong(self):
        r = self.scanner.evaluate(MarketRegime.BULL, turbo_full(catalyst=False))
        self.assertEqual(r.score, D("94"))
        self.assertEqual(r.classification, TradeClassification.STRONG)

    def test_no_orb_no_momentum_watchlist(self):
        r = self.scanner.evaluate(MarketRegime.BULL,
                                  turbo_full(orb_confirmed=False, momentum_ok=False))
        self.assertEqual(r.score, D("65"))
        self.assertEqual(r.classification, TradeClassification.WATCHLIST)

    def test_valid_short_in_bear(self):
        r = self.scanner.evaluate(
            MarketRegime.BEAR, turbo_full(direction=Direction.SHORT, above_vwap=False))
        self.assertEqual(r.score, D("100"))
        self.assertEqual(r.direction, Direction.SHORT)


class TestTurboGates(unittest.TestCase):
    def setUp(self):
        self.scanner = TurboScanner()

    def test_atr_below_min_dropped(self):
        self.assertIsNone(self.scanner.evaluate(MarketRegime.BULL, turbo_full(atr=D("0.4"))))

    def test_low_liquidity_dropped(self):
        self.assertIsNone(self.scanner.evaluate(MarketRegime.BULL, turbo_full(adv=100_000)))

    def test_low_premarket_dropped(self):
        self.assertIsNone(self.scanner.evaluate(MarketRegime.BULL, turbo_full(premarket_volume=50_000)))

    def test_rvol_below_3_dropped(self):
        self.assertIsNone(self.scanner.evaluate(MarketRegime.BULL, turbo_full(rvol=D("2.9"))))

    def test_gap_below_4pct_dropped(self):
        self.assertIsNone(self.scanner.evaluate(MarketRegime.BULL, turbo_full(gap_pct=D("0.03"))))

    def test_long_below_vwap_dropped(self):
        self.assertIsNone(self.scanner.evaluate(MarketRegime.BULL, turbo_full(above_vwap=False)))

    def test_short_above_vwap_dropped(self):
        self.assertIsNone(self.scanner.evaluate(
            MarketRegime.BEAR, turbo_full(direction=Direction.SHORT, above_vwap=True)))

    def test_short_in_bull_dropped(self):
        self.assertIsNone(self.scanner.evaluate(
            MarketRegime.BULL, turbo_full(direction=Direction.SHORT, above_vwap=False)))


class TestClassification(unittest.TestCase):
    def test_bands(self):
        self.assertEqual(classify_score(D("100")), TradeClassification.ULTRA_GOLDEN)
        self.assertEqual(classify_score(D("95")), TradeClassification.GOLDEN)
        self.assertEqual(classify_score(D("99")), TradeClassification.GOLDEN)
        self.assertEqual(classify_score(D("94")), TradeClassification.STRONG)
        self.assertEqual(classify_score(D("90")), TradeClassification.STRONG)
        self.assertEqual(classify_score(D("89.9")), TradeClassification.WATCHLIST)
        self.assertEqual(
            TradeClassificationEngine().classify(D("100")),
            TradeClassification.ULTRA_GOLDEN,
        )


class TestRankingAndEngine(unittest.TestCase):
    def test_rank_desc_with_symbol_tiebreak(self):
        cands = [
            ScoredCandidate("B", EngineType.CORE, Direction.LONG, D("90"),
                            TradeClassification.STRONG),
            ScoredCandidate("A", EngineType.CORE, Direction.LONG, D("90"),
                            TradeClassification.STRONG),
            ScoredCandidate("C", EngineType.CORE, Direction.LONG, D("100"),
                            TradeClassification.ULTRA_GOLDEN),
        ]
        ranked = RankingEngine().rank(cands)
        self.assertEqual([c.symbol for c in ranked], ["C", "A", "B"])

    def test_selection_engine_run(self):
        eng = SelectionEngine()
        res = eng.run(
            market("bull"),
            core_candidates=[core_full(symbol="AAA"), core_full(symbol="BBB", rvol=D("1.6"))],
            turbo_candidates=[turbo_full(symbol="TTT")],
        )
        self.assertEqual(res.regime, MarketRegime.BULL)
        self.assertEqual(len(res.core), 2)
        self.assertEqual(len(res.turbo), 1)
        # ranked desc: AAA(100) before BBB(95.5)
        self.assertEqual([c.symbol for c in res.core], ["AAA", "BBB"])

    def test_determinism(self):
        eng = SelectionEngine()
        m = market("bull")
        c = [core_full(symbol="AAA"), core_full(symbol="BBB")]
        r1 = eng.run_core(m, c)
        r2 = eng.run_core(m, c)
        self.assertEqual([(x.symbol, x.score) for x in r1],
                         [(x.symbol, x.score) for x in r2])

    def test_sideways_emits_nothing(self):
        eng = SelectionEngine()
        res = eng.run(market("sideways"),
                      core_candidates=[core_full()],
                      turbo_candidates=[turbo_full()])
        self.assertEqual(res.core, [])
        self.assertEqual(res.turbo, [])


if __name__ == "__main__":
    unittest.main()
