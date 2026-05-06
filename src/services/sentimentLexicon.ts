/**
 * Curated subset of the Loughran-McDonald Financial Sentiment Dictionary.
 * This is the standard academic lexicon built specifically for financial text
 * (news, earnings calls, SEC filings) rather than general English sentiment.
 *
 * Reference: Loughran & McDonald (2011), "When Is a Liability Not a Liability?"
 * Journal of Finance.
 */

const NEGATIVE_WORDS = new Set([
  'abandon', 'abandonment', 'abuse', 'adverse', 'adversely', 'adversity',
  'allegation', 'allegations', 'alleged', 'bankrupt', 'bankruptcy',
  'breach', 'breached', 'bribery', 'burden', 'burdensome',
  'cancel', 'catastrophe', 'cease', 'charged', 'circumvent',
  'claim', 'claims', 'closure', 'complaint', 'complaints', 'concern',
  'concerns', 'confiscate', 'criminal', 'crisis', 'curtail',
  'cutback', 'damage', 'damages', 'danger', 'dangerous',
  'decline', 'declined', 'declining', 'default', 'defaulted',
  'deficit', 'delinquent', 'denied', 'depreciate', 'depreciation',
  'deteriorate', 'deteriorating', 'difficult', 'difficulties',
  'disappoint', 'disappointing', 'disappointment', 'disaster',
  'dispute', 'disputes', 'distress', 'doubt', 'doubtful',
  'downgrade', 'downgraded', 'downturn', 'dropped', 'error',
  'errors', 'evade', 'excessive', 'expire', 'failure',
  'failures', 'falsified', 'fine', 'fined', 'fired',
  'force', 'forfeiture', 'fraud', 'fraudulent', 'guilty',
  'halt', 'halted', 'harm', 'harmful', 'impair',
  'impaired', 'impairment', 'inadequate', 'ineffective', 'injunction',
  'insolvent', 'insolvency', 'interrupt', 'investigation', 'illegal',
  'lawsuit', 'layoff', 'layoffs', 'liability', 'liabilities',
  'liquidation', 'litigation', 'loss', 'losses', 'misstate',
  'misstatement', 'misconduct', 'negative', 'negligence', 'noncompliance',
  'obstacle', 'obsolete', 'penalty', 'penalties', 'poor',
  'problem', 'problems', 'prohibition', 'recall', 'recalling',
  'restate', 'restatement', 'restructure', 'restructuring', 'risk',
  'risks', 'scandal', 'scrutiny', 'seizure', 'severe',
  'shortfall', 'shortage', 'slow', 'slowed', 'slowing',
  'slowdown', 'struggle', 'struggling', 'suffered', 'suffer',
  'suspend', 'suspended', 'terminate', 'terminated', 'threat',
  'threatened', 'trouble', 'troubled', 'uncertain', 'uncertainty',
  'unfavorable', 'unprofitable', 'unstable', 'violation',
  'violations', 'vulnerable', 'warn', 'warning', 'weak',
  'weakened', 'weakening', 'worsen', 'worsening', 'writeoff',
  'write-off', 'writedown', 'write-down',
])

const POSITIVE_WORDS = new Set([
  'accomplish', 'accomplished', 'achievement', 'advance', 'advanced',
  'advantage', 'affirm', 'affirmed', 'agreement', 'approved',
  'beat', 'beats', 'benefit', 'beneficial', 'breakthrough',
  'capitalize', 'celebrate', 'confident', 'confidence', 'consistent',
  'deliver', 'delivered', 'develop', 'development', 'distinguished',
  'dividend', 'effective', 'efficiency', 'efficient', 'enhance',
  'enhanced', 'enhancement', 'exceed', 'exceeded', 'exceeds',
  'excel', 'exceptional', 'expand', 'expanded', 'expansion',
  'favorable', 'gain', 'gained', 'gains', 'generate',
  'generated', 'growth', 'growing', 'grew', 'improved',
  'improvement', 'increase', 'increased', 'increasing', 'innovate',
  'innovation', 'innovative', 'invest', 'investment', 'launch',
  'launched', 'leads', 'leading', 'milestone', 'momentum',
  'optimize', 'optimized', 'outperform', 'outperformed', 'outperforming',
  'overcome', 'partner', 'partnership', 'pioneer', 'positive',
  'profit', 'profitable', 'profitability', 'progress', 'progressing',
  'promote', 'prosper', 'raise', 'raised', 'rebound',
  'rebounded', 'record', 'recover', 'recovered', 'recovery',
  'reliable', 'revenue', 'reward', 'robust', 'secure',
  'secured', 'solid', 'strength', 'strengthen', 'strengthened',
  'succeed', 'success', 'successful', 'superior', 'surge',
  'surged', 'surging', 'sustain', 'sustainable', 'transform',
  'transformative', 'upgrade', 'upgraded', 'value', 'win',
  'winner', 'winning', 'strong', 'stronger', 'strongest',
])

/**
 * Score a piece of financial text using the Loughran-McDonald lexicon.
 * Returns a value in [-1, +1]:
 *   -1 = strongly negative, 0 = neutral, +1 = strongly positive.
 */
export function scoreSentimentFromText(text: string): number {
  const words = text
    .toLowerCase()
    .replace(/[^a-z\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)

  if (words.length === 0) return 0

  let positiveCount = 0
  let negativeCount = 0

  for (const word of words) {
    if (POSITIVE_WORDS.has(word)) positiveCount++
    else if (NEGATIVE_WORDS.has(word)) negativeCount++
  }

  const total = positiveCount + negativeCount
  if (total === 0) return 0

  // Net sentiment ratio, normalised to [-1, +1]
  return (positiveCount - negativeCount) / total
}
