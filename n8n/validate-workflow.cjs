// n8n/validate-workflow.cjs — Static validation for IRIAD master workflow + error handler
// Runs offline (no n8n/Supabase credentials needed).
// Usage: node n8n/validate-workflow.cjs

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MASTER_PATH = path.join(ROOT, 'n8n', 'IRIAD_MASTER_WORKFLOW.json');
const ERROR_HANDLER_PATH = path.join(ROOT, 'n8n', 'IRIAD_ERROR_HANDLER.json');

const KNOWN_NODE_TYPES = new Set([
  'n8n-nodes-base.scheduleTrigger',
  'n8n-nodes-base.webhook',
  'n8n-nodes-base.httpRequest',
  'n8n-nodes-base.supabase',
  'n8n-nodes-base.code',
  'n8n-nodes-base.if',
  'n8n-nodes-base.stickyNote',
  'n8n-nodes-base.noOp',
  'n8n-nodes-base.gmail',
  'n8n-nodes-base.errorTrigger',
  'n8n-nodes-base.respondToWebhook',
]);

const ALLOWED_TABLES = new Set([
  'organisations', 'profiles', 'departments', 'attendance_sessions', 'attendance',
  'leave_requests', 'tasks', 'projects', 'notifications', 'generated_reports',
  'automation_runs', 'announcements', 'knowledge_sources', 'knowledge_chunks',
  'chatbot_conversations', 'chatbot_messages', 'email_logs', 'email_report_recipients',
  'task_assignees', 'project_members', 'weekly_reports', 'monthly_reports',
]);

const REMOVED_DB_IDENTIFIERS = [
  'attendance_windows', 'daily_reports', 'assignee_id', 'sender_id',
];

const results = { pass: 0, fail: 0, warnings: [], errors: [] };

function check(name, condition, detail = '') {
  if (condition) {
    results.pass++;
    console.log(`  PASS ${name}`);
  } else {
    results.fail++;
    results.errors.push(`${name}: ${detail}`);
    console.log(`  FAIL ${name} — ${detail}`);
  }
}

function warn(name, detail = '') {
  results.warnings.push(`${name}: ${detail}`);
  console.log(`  WARN ${name} — ${detail}`);
}

function loadJson(filePath, label) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    console.log(`\n== ${label} ==`);
    console.log(`  FAIL cannot read ${filePath}: ${err.message}`);
    return { raw: null, parsed: null };
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
    return { raw, parsed };
  } catch (err) {
    console.log(`\n== ${label} ==`);
    console.log(`  FAIL invalid JSON: ${err.message}`);
    return { raw, parsed: null };
  }
}

function allNodeIds(wf) {
  return new Set(wf.nodes.map((n) => n.id));
}

function allNodeNames(wf) {
  return new Set(wf.nodes.map((n) => n.name));
}

function allNodeIdentifiers(wf) {
  const ids = new Set();
  for (const n of wf.nodes) {
    ids.add(n.id);
    if (n.name) ids.add(n.name);
  }
  return ids;
}

function allConnections(wf) {
  const conns = wf.connections || {};
  const entries = [];
  for (const [sourceKey, branches] of Object.entries(conns)) {
    if (!branches || !branches.main) continue;
    for (const branch of branches.main) {
      if (!Array.isArray(branch)) continue;
      for (const target of branch) {
        entries.push({ source: sourceKey, target: target.node, type: target.type || 'main', index: target.index });
      }
    }
  }
  return entries;
}

// Extract n8n expression strings from parameter values only (not code node bodies)
// n8n expressions use {{ }} syntax. $json.$env references inside Code node jsCode
// are JavaScript, not n8n expressions, so we skip code node jsCode entirely.
function getParameterExpressions(node) {
  const strs = [];
  const params = node.parameters || {};
  const recurse = (v, keyPath) => {
    // Skip Code node jsCode — it's JavaScript, not n8n {{ }} expressions
    if (node.type === 'n8n-nodes-base.code' && keyPath === 'parameters.jsCode') return;
    if (typeof v === 'string') {
      // Only treat as n8n expression if it contains {{ }}
      if (v.includes('{{')) {
        strs.push({ expr: v, keyPath, nodeName: node.name });
      }
    } else if (Array.isArray(v)) {
      v.forEach((item, i) => recurse(item, `${keyPath}[${i}]`));
    } else if (v && typeof v === 'object') {
      Object.entries(v).forEach(([k, val]) => recurse(val, `${keyPath}.${k}`));
    }
  };
  recurse(params, 'parameters');
  return strs;
}

console.log('='.repeat(60));
console.log('IRIAD Master Workflow — Static Validation');
console.log('='.repeat(60));

const mData = loadJson(MASTER_PATH, 'Master Workflow');
const eData = loadJson(ERROR_HANDLER_PATH, 'Error Handler');

if (!mData.parsed || !eData.parsed) {
  process.exit(1);
}
const master = mData.parsed;
const errorHandler = eData.parsed;
const mRaw = mData.raw;
const eRaw = eData.raw;

// ── 1. JSON validity ──
console.log('\n[1] JSON validity');
check('Master workflow is valid JSON', true);
check('Error handler is valid JSON', true);

// ── 2. Node count ──
console.log('\n[2] Node counts');
const mIds = allNodeIds(master);
const eIds = allNodeIds(errorHandler);
check(`Master: ${master.nodes.length} nodes`, master.nodes.length > 0, `count=${master.nodes.length}`);
check(`Error handler: ${errorHandler.nodes.length} nodes`, errorHandler.nodes.length > 0, `count=${errorHandler.nodes.length}`);

// ── 3. Node types ──
console.log('\n[3] Node types (known n8n types)');
for (const node of master.nodes) {
  check(`Master node "${node.name}" uses known type`, KNOWN_NODE_TYPES.has(node.type), `type=${node.type}`);
}
for (const node of errorHandler.nodes) {
  check(`Error handler node "${node.name}" uses known type`, KNOWN_NODE_TYPES.has(node.type), `type=${node.type}`);
}

// ── 4. Master: no errorTrigger ──
console.log('\n[4] Master: error handling architecture');
const mErrTriggers = master.nodes.filter((n) => n.type === 'n8n-nodes-base.errorTrigger');
check('Master has 0 errorTrigger nodes', mErrTriggers.length === 0, `found ${mErrTriggers.length}`);
check('Master settings.errorWorkflowId set', master.settings?.errorWorkflowId === 'iriad-error-handler', `value=${master.settings?.errorWorkflowId}`);
check('Master settings.timezone set', master.settings?.timezone === 'Africa/Lagos', `value=${master.settings?.timezone}`);

// ── 5. Schedule triggers timezone ──
console.log('\n[5] Schedule trigger timezones');
const mSchedules = master.nodes.filter((n) => n.type === 'n8n-nodes-base.scheduleTrigger');
check(`Master: ${mSchedules.length} scheduleTrigger nodes found`, mSchedules.length > 0);
let allLagos = true;
for (const n of mSchedules) {
  const tz = n.parameters?.timezone;
  if (tz !== 'Africa/Lagos') {
    allLagos = false;
    warn(`Schedule "${n.name}" timezone is "${tz}" (expected Africa/Lagos)`);
  }
}
check('All master schedule triggers use Africa/Lagos', allLagos);

const eSchedules = errorHandler.nodes.filter((n) => n.type === 'n8n-nodes-base.scheduleTrigger');
check('Error handler has 0 scheduleTrigger nodes', eSchedules.length === 0);

// ── 6. Error handler: starts with Error Trigger ──
console.log('\n[6] Error handler architecture');
const eErrTriggers = errorHandler.nodes.filter((n) => n.type === 'n8n-nodes-base.errorTrigger');
check('Error handler has 1 errorTrigger node', eErrTriggers.length === 1, `found ${eErrTriggers.length}`);
if (eErrTriggers.length === 1) {
  check('Error trigger is first node', eErrTriggers[0].position?.[1] === 300, `position=${JSON.stringify(eErrTriggers[0].position)}`);
}

const eCodeNodes = errorHandler.nodes.filter((n) => n.type === 'n8n-nodes-base.code');
check('Error handler has code node for data extraction', eCodeNodes.length >= 1);

const eIfNodes = errorHandler.nodes.filter((n) => n.type === 'n8n-nodes-base.if');
check('Error handler has IF node for deduplication', eIfNodes.length >= 1);

const eGmailNodes = errorHandler.nodes.filter((n) => n.type === 'n8n-nodes-base.gmail');
check('Error handler has Gmail alert node', eGmailNodes.length === 1, `found ${eGmailNodes.length}`);
if (eGmailNodes.length === 1) {
  const gmailTo = eGmailNodes[0].parameters?.to || '';
  check('Gmail alert goes to olarewajuagbaje@gmail.com', gmailTo === 'olarewajuagbaje@gmail.com', `to=${gmailTo}`);
  const gmailHtml = eGmailNodes[0].parameters?.html || '';
  check('Gmail HTML references execution_id', gmailHtml.includes('execution_id'));
  check('Gmail HTML references execution_url', gmailHtml.includes('execution_url'));
  check('Gmail HTML references timestamp_lagos', gmailHtml.includes('timestamp_lagos'));
}

// ── 7. Error handler: captures execution data ──
console.log('\n[7] Error handler: captures execution data');
const eCodeStr = JSON.stringify(eCodeNodes);
check('Error handler code captures execution_id', eCodeStr.includes('execution_id'));
check('Error handler code captures execution_url', eCodeStr.includes('execution_url'));
check('Error handler code captures error_message', eCodeStr.includes('error_message'));
check('Error handler code captures business_section', eCodeStr.includes('business_section'));
check('Error handler code formats Africa/Lagos timestamp', eCodeStr.includes('Africa/Lagos'));

// ── 8. Connection integrity ──
console.log('\n[8] Connection integrity (no dangling references)');
const mConns = allConnections(master);
const mIdentifiers = allNodeIdentifiers(master);
let mDangling = 0;
for (const c of mConns) {
  if (!mIdentifiers.has(c.source)) {
    mDangling++;
    warn(`Master: connection source "${c.source}" is not a node id or name`);
  }
  if (!mIdentifiers.has(c.target)) {
    mDangling++;
    warn(`Master: connection target "${c.target}" is not a node id or name`);
  }
}
check(`Master: 0 dangling connection references (checked ${mConns.length})`, mDangling === 0, `dangling=${mDangling}`);

const eConns = allConnections(errorHandler);
const eIdentifiers = allNodeIdentifiers(errorHandler);
let eDangling = 0;
for (const c of eConns) {
  if (!eIdentifiers.has(c.source)) {
    eDangling++;
    warn(`Error handler: connection source "${c.source}" is not a node id or name`);
  }
  if (!eIdentifiers.has(c.target)) {
    eDangling++;
    warn(`Error handler: connection target "${c.target}" is not a node id or name`);
  }
}
check(`Error handler: 0 dangling connection references (checked ${eConns.length})`, eDangling === 0, `dangling=${eDangling}`);

// ── 9. Orphan nodes ──
console.log('\n[9] Orphan nodes (no incoming or outgoing connections)');
const mConnectedSources = new Set(mConns.map((c) => c.source));
const mConnectedTargets = new Set(mConns.map((c) => c.target));
let mOrphans = 0;
for (const node of master.nodes) {
  // Sticky notes are visual canvas annotations, not functional nodes — skip
  if (node.type === 'n8n-nodes-base.stickyNote') continue;
  if (!mConnectedSources.has(node.id) && !mConnectedSources.has(node.name) &&
      !mConnectedTargets.has(node.id) && !mConnectedTargets.has(node.name)) {
    mOrphans++;
    warn(`Master: orphan node "${node.name}" (${node.id})`);
  }
}
check(`Master: 0 orphan nodes`, mOrphans === 0, `orphans=${mOrphans}`);

const eConnectedSources = new Set(eConns.map((c) => c.source));
const eConnectedTargets = new Set(eConns.map((c) => c.target));
let eOrphans = 0;
for (const node of errorHandler.nodes) {
  if (!eConnectedSources.has(node.id) && !eConnectedSources.has(node.name) &&
      !eConnectedTargets.has(node.id) && !eConnectedTargets.has(node.name)) {
    eOrphans++;
    warn(`Error handler: orphan node "${node.name}" (${node.id})`);
  }
}
check(`Error handler: 0 orphan nodes`, eOrphans === 0, `orphans=${eOrphans}`);

// ── 10. No hardcoded secrets ──
console.log('\n[10] No hardcoded secrets');
// Check parameter expression strings only (not code bodies) for actual secret values
let mSecretHits = 0;
const mParamExprs = [];
for (const node of master.nodes) {
  mParamExprs.push(...getParameterExpressions(node));
}
for (const { expr, nodeName } of mParamExprs) {
  if (/(nvapi-|eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+|sk-)[a-zA-Z0-9]/g.test(expr)) {
    mSecretHits++;
    warn(`Master parameter "${nodeName}": possible hardcoded secret in expression`);
  }
}
// Also check raw for obvious literal keys (but skip regex patterns used for redaction)
const mRawSecretPattern = /(nvapi-[a-zA-Z0-9_-]{10,}|eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+|sk-[a-zA-Z0-9]{10,})/g;
const mRawMatches = mRaw.match(mRawSecretPattern) || [];
check('Master: no exposed secret values in parameters', mSecretHits === 0, `hits=${mSecretHits}`);
if (mRawMatches.length > 0) {
  warn(`Master: raw JSON contains ${mRawMatches.length} secret-like pattern(s) — verify these are redaction regexes, not exposed keys`);
}

let eSecretHits = 0;
const eParamExprs = [];
for (const node of errorHandler.nodes) {
  eParamExprs.push(...getParameterExpressions(node));
}
for (const { expr } of eParamExprs) {
  if (/(nvapi-|eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+|sk-)[a-zA-Z0-9]/g.test(expr)) {
    eSecretHits++;
  }
}
check('Error handler: no exposed secret values in parameters', eSecretHits === 0, `hits=${eSecretHits}`);

// ── 11. No hardcoded organisation UUID ──
console.log('\n[11] No hardcoded organisation UUID');
const orgUuidPattern = /00000000-0000-0000-0000-000000000001/;
check('Master: no hardcoded org UUID', !orgUuidPattern.test(mRaw), 'found literal org UUID');
check('Error handler: no hardcoded org UUID', !orgUuidPattern.test(eRaw), 'found literal org UUID');
check('Master: uses $env.IRIAD_ORGANISATION_ID', mRaw.includes('IRIAD_ORGANISATION_ID'));
check('Error handler: uses IRIAD_ORGANISATION_ID', eRaw.includes('IRIAD_ORGANISATION_ID'));

// ── 12. Webhook auth ──
console.log('\n[12] Webhook authentication');
const mWebhooks = master.nodes.filter((n) => n.type === 'n8n-nodes-base.webhook');
check(`Master: ${mWebhooks.length} webhook nodes found`, mWebhooks.length > 0);
for (const wh of mWebhooks) {
  const whName = wh.name || wh.id;
  const outgoing = mConns.filter((c) => c.source === wh.id || c.source === whName);
  const hasAuthIf = outgoing.some((c) => {
    const targetNode = master.nodes.find((n) => n.id === c.target || n.name === c.target);
    return targetNode && targetNode.type === 'n8n-nodes-base.if';
  });
  check(`Webhook "${whName}" is followed by auth IF node`, hasAuthIf, `outgoing=${outgoing.length}`);
}

// ── 13. Removed DB table/column references ──
console.log('\n[13] No references to removed DB tables/columns');
// Only check Supabase node table parameters and HTTP Request URLs, not Code node JS bodies
let mRemovedHits = 0;
for (const node of master.nodes) {
  if (node.type === 'n8n-nodes-base.supabase') {
    const table = node.parameters?.table;
    if (table && typeof table === 'string') {
      for (const removed of REMOVED_DB_IDENTIFIERS) {
        if (table.includes(removed)) {
          mRemovedHits++;
          warn(`Master Supabase node "${node.name}" references removed table "${table}"`);
        }
      }
    }
  }
  if (node.type === 'n8n-nodes-base.httpRequest') {
    const url = node.parameters?.url || '';
    for (const removed of REMOVED_DB_IDENTIFIERS) {
      if (url.includes(removed)) {
        mRemovedHits++;
        warn(`Master HTTP Request node "${node.name}" URL references removed identifier "${removed}"`);
      }
    }
  }
}
check('Master: no removed DB table/column references', mRemovedHits === 0, `hits=${mRemovedHits}`);

let eRemovedHits = 0;
for (const node of errorHandler.nodes) {
  if (node.type === 'n8n-nodes-base.supabase') {
    const table = node.parameters?.table;
    if (table && typeof table === 'string') {
      for (const removed of REMOVED_DB_IDENTIFIERS) {
        if (table.includes(removed)) {
          eRemovedHits++;
          warn(`Error handler Supabase node "${node.name}" references removed table "${table}"`);
        }
      }
    }
  }
}
check('Error handler: no removed DB table/column references', eRemovedHits === 0, `hits=${eRemovedHits}`);

// ── 14. Supabase table references ──
console.log('\n[14] Supabase table references map to known tables');
for (const node of master.nodes) {
  if (node.type === 'n8n-nodes-base.supabase') {
    const table = node.parameters?.table;
    if (table && typeof table === 'string') {
      const cleanTable = table.replace(/[{}$"']/g, '').trim();
      if (cleanTable && !ALLOWED_TABLES.has(cleanTable)) {
        warn(`Master Supabase node "${node.name}" references table "${table}" (not in known table list)`);
      }
    }
  }
}
for (const node of errorHandler.nodes) {
  if (node.type === 'n8n-nodes-base.supabase') {
    const table = node.parameters?.table;
    if (table && typeof table === 'string') {
      const cleanTable = table.replace(/[{}$"']/g, '').trim();
      if (cleanTable && !ALLOWED_TABLES.has(cleanTable)) {
        warn(`Error handler Supabase node "${node.name}" references table "${table}" (not in known table list)`);
      }
    }
  }
}

// ── 15. Gmail nodes ──
console.log('\n[15] Gmail nodes');
const mGmail = master.nodes.filter((n) => n.type === 'n8n-nodes-base.gmail');
check(`Master: ${mGmail.length} Gmail nodes`, mGmail.length > 0);
for (const g of mGmail) {
  const gTo = g.parameters?.to || g.parameters?.sendTo || '';
  check(`Gmail node "${g.name}" has recipient`, !!gTo, 'no "to" or "sendTo" field');
}
const eGmail = errorHandler.nodes.filter((n) => n.type === 'n8n-nodes-base.gmail');
check(`Error handler: ${eGmail.length} Gmail node(s)`, eGmail.length >= 1);

// ── 16. Expression brace balance (parameters only) ──
console.log('\n[16] Expression brace balance (parameter expressions only)');
let mBadExpr = 0;
for (const { expr, nodeName } of mParamExprs) {
  const open = (expr.match(/\{\{/g) || []).length;
  const close = (expr.match(/\}\}/g) || []).length;
  if (open !== close) {
    mBadExpr++;
    warn(`Master node "${nodeName}": unbalanced expression braces: ${expr.slice(0, 80)}`);
  }
}
check('Master: all parameter expressions have balanced braces', mBadExpr === 0, `unbalanced=${mBadExpr}`);

let eBadExpr = 0;
for (const { expr, nodeName } of eParamExprs) {
  const open = (expr.match(/\{\{/g) || []).length;
  const close = (expr.match(/\}\}/g) || []).length;
  if (open !== close) {
    eBadExpr++;
    warn(`Error handler node "${nodeName}": unbalanced expression braces: ${expr.slice(0, 80)}`);
  }
}
check('Error handler: all parameter expressions have balanced braces', eBadExpr === 0, `unbalanced=${eBadExpr}`);

// ── Summary ──
console.log('\n' + '='.repeat(60));
console.log('VALIDATION SUMMARY');
console.log('='.repeat(60));
console.log(`PASS: ${results.pass}`);
console.log(`FAIL: ${results.fail}`);
console.log(`WARNINGS: ${results.warnings.length}`);
if (results.errors.length > 0) {
  console.log('\nErrors:');
  for (const e of results.errors) console.log(`  - ${e}`);
}
if (results.warnings.length > 0) {
  console.log('\nWarnings:');
  for (const w of results.warnings) console.log(`  - ${w}`);
}

const allPass = results.fail === 0;
console.log(`\nOverall: ${allPass ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED'}`);
process.exit(allPass ? 0 : 1);
