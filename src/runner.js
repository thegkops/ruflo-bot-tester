/**
 * Test runner — executes a parsed test suite against a bot adapter,
 * collects responses, runs evaluation, and returns structured results.
 */

import { evaluate } from './evaluator.js';
import { AnthropicAdapter } from './adapters/anthropic.js';
import { OpenAIAdapter }    from './adapters/openai.js';
import { HttpAdapter }      from './adapters/http.js';

function buildAdapter(botConfig) {
  switch ((botConfig.provider || 'http').toLowerCase()) {
    case 'anthropic': return new AnthropicAdapter(botConfig);
    case 'openai':    return new OpenAIAdapter(botConfig);
    default:          return new HttpAdapter(botConfig);
  }
}

async function runTest(test, adapter, suiteEvaluators, logger) {
  const startTime = Date.now();
  const history   = [];  // conversation history
  const turns     = [];  // recorded turn results

  logger.testStart(test);

  for (const step of test.turns) {
    // Step can be: { user: "..." } or { user: "...", assert_contains: "..." }
    const userMessage = step.user;
    if (!userMessage) continue;

    history.push({ role: 'user', content: userMessage });

    let response = null;
    let latency_ms = 0;
    let error = null;

    try {
      const result = await adapter.send([...history]);
      response   = result.content;
      latency_ms = result.latency_ms;
      history.push({ role: 'assistant', content: response });
    } catch (e) {
      error = e.message;
    }

    // Mid-turn assertion (assert_contains on a specific turn)
    const turnExpect = {};
    if (step.assert_contains) turnExpect.contains = [step.assert_contains];
    if (step.assert_not_contains) turnExpect.not_contains = [step.assert_not_contains];

    const turnResult = {
      user: userMessage,
      response,
      latency_ms,
      error,
      checks: [],
      passed: !error,
    };

    if (response && Object.keys(turnExpect).length > 0) {
      const ev = await evaluate({
        question: userMessage,
        response,
        latency_ms,
        expect: turnExpect,
        evaluators: ['format'],
      });
      turnResult.checks = ev.checks;
      turnResult.passed = !error && ev.passed;
    }

    turns.push(turnResult);
    if (error) break;
  }

  // Final-turn evaluation (full evaluator suite)
  const lastTurn = turns[turns.length - 1];
  const finalResult = { ...lastTurn };

  if (lastTurn?.response && test.expect) {
    const evaluators = test.evaluators || suiteEvaluators || [];
    const ev = await evaluate({
      question: lastTurn.user,
      response: lastTurn.response,
      latency_ms: lastTurn.latency_ms,
      expect: test.expect,
      evaluators,
    });
    finalResult.checks  = [...(lastTurn.checks || []), ...ev.checks];
    finalResult.score   = ev.score;
    finalResult.passed  = !lastTurn.error && ev.passed;
    turns[turns.length - 1] = finalResult;
  }

  const passed = turns.every(t => t.passed) && !turns.some(t => t.error);
  const duration_ms = Date.now() - startTime;

  logger.testEnd(test, { passed, turns, duration_ms });

  return {
    id:          test.id,
    name:        test.name,
    tags:        test.tags || [],
    passed,
    duration_ms,
    turns,
    score: finalResult.score ?? null,
  };
}

export async function runSuite(suite, logger) {
  const adapter    = buildAdapter(suite.bot);
  const evaluators = suite.evaluators || [];
  const results    = [];

  logger.suiteStart(suite);

  for (const test of suite.tests) {
    if (test.skip) {
      logger.testSkip(test);
      results.push({ id: test.id, name: test.name, tags: test.tags || [], skipped: true });
      continue;
    }
    const result = await runTest(test, adapter, evaluators, logger);
    results.push(result);
  }

  const passed  = results.filter(r => !r.skipped && r.passed).length;
  const failed  = results.filter(r => !r.skipped && !r.passed).length;
  const skipped = results.filter(r => r.skipped).length;
  const scores  = results.filter(r => r.score != null).map(r => r.score);
  const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

  logger.suiteEnd({ passed, failed, skipped, avgScore });

  return {
    suite_name: suite.name || 'Unnamed Suite',
    bot: suite.bot,
    ran_at: new Date().toISOString(),
    summary: { passed, failed, skipped, total: results.length, avg_score: avgScore },
    results,
  };
}
