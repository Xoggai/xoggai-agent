import { pathToFileURL } from 'node:url'

function baseUrl(env) {
  const url = new URL(
    env.XOGGAI_API_BASE || 'https://xoggai-backend.onrender.com',
  )
  if (url.protocol !== 'https:' && url.hostname !== 'localhost') {
    throw new Error('XOGGAI_API_BASE must use HTTPS unless local')
  }
  return url.toString().replace(/\/$/, '')
}

function adminKey(env) {
  const key = env.PUBLIC_BETA_ADMIN_KEY
  if (!key || key.length < 32) {
    throw new Error('PUBLIC_BETA_ADMIN_KEY must contain at least 32 characters')
  }
  return key
}

async function request(path, { env, method = 'GET', body, fetchImpl }) {
  const response = await fetchImpl(`${baseUrl(env)}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      'x-admin-key': adminKey(env),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    redirect: 'error',
    signal: AbortSignal.timeout(15_000),
  })
  const text = await response.text()
  const parsed = JSON.parse(text)
  if (!response.ok) {
    throw new Error(`Admin request failed (${response.status}): ${text}`)
  }
  return parsed
}

export async function runPublicBetaAdmin({
  argv = process.argv.slice(2),
  env = process.env,
  fetchImpl = fetch,
  log = console.log,
} = {}) {
  const command = argv[0]
  if (command === 'create-user') {
    const [email, displayName, keyLabel = 'Primary'] = argv.slice(1)
    if (!email || !displayName) {
      throw new Error(
        'create-user requires <email> <displayName> [keyLabel]',
      )
    }
    const result = await request('/api/admin/beta/users', {
      env,
      method: 'POST',
      fetchImpl,
      body: {
        email,
        displayName,
        keyLabel,
        maxBudgetUsdc: Number(env.BETA_USER_MAX_BUDGET_USDC || '0.005'),
        dailyRequestLimit: Number(env.BETA_USER_DAILY_REQUEST_LIMIT || '25'),
        dailyBudgetUsdc: Number(env.BETA_USER_DAILY_BUDGET_USDC || '0.05'),
      },
    })
    log(JSON.stringify(result, null, 2))
    return result
  }
  if (command === 'requests') {
    const status = argv[1] || 'REQUESTED'
    const result = await request(
      `/api/admin/beta/requests?status=${encodeURIComponent(status)}&limit=50`,
      { env, fetchImpl },
    )
    log(JSON.stringify(result, null, 2))
    return result
  }
  if (command === 'users') {
    const result = await request('/api/admin/beta/users', {
      env,
      fetchImpl,
    })
    log(JSON.stringify(result, null, 2))
    return result
  }
  if (command === 'ops') {
    const result = await request('/api/admin/ops', {
      env,
      fetchImpl,
    })
    log(JSON.stringify(result, null, 2))
    return result
  }
  if (command === 'set-user-status') {
    const [userId, status] = argv.slice(1)
    if (!userId || !['ACTIVE', 'SUSPENDED'].includes(status)) {
      throw new Error(
        'set-user-status requires <userId> <ACTIVE|SUSPENDED>',
      )
    }
    const result = await request(`/api/admin/beta/users/${userId}`, {
      env,
      method: 'PATCH',
      fetchImpl,
      body: {
        status,
        actorId: env.X402_OPERATOR || 'public-beta-admin-cli',
      },
    })
    log(JSON.stringify(result, null, 2))
    return result
  }
  if (command === 'create-key') {
    const [userId, label = 'Rotated key'] = argv.slice(1)
    if (!userId) throw new Error('create-key requires <userId> [label]')
    const result = await request(`/api/admin/beta/users/${userId}/keys`, {
      env,
      method: 'POST',
      fetchImpl,
      body: { label },
    })
    log(JSON.stringify(result, null, 2))
    return result
  }
  if (command === 'keys') {
    const userId = argv[1]
    if (!userId) throw new Error('keys requires <userId>')
    const result = await request(`/api/admin/beta/users/${userId}/keys`, {
      env,
      fetchImpl,
    })
    log(JSON.stringify(result, null, 2))
    return result
  }
  if (command === 'revoke-key') {
    const keyId = argv[1]
    if (!keyId) throw new Error('revoke-key requires <keyId>')
    const result = await request(`/api/admin/beta/keys/${keyId}/revoke`, {
      env,
      method: 'POST',
      fetchImpl,
    })
    log(JSON.stringify(result, null, 2))
    return result
  }
  if (command === 'decide') {
    const [id, status, reason = 'Reviewed by operator'] = argv.slice(1)
    if (!id || !['APPROVED', 'REJECTED', 'CANCELLED'].includes(status)) {
      throw new Error(
        'decide requires <requestId> <APPROVED|REJECTED|CANCELLED> [reason]',
      )
    }
    const result = await request(`/api/admin/beta/requests/${id}`, {
      env,
      method: 'PATCH',
      fetchImpl,
      body: {
        status,
        reason,
        approvedBy: env.X402_OPERATOR || 'public-beta-admin-cli',
      },
    })
    log(JSON.stringify(result, null, 2))
    return result
  }
  throw new Error(
    'Use: create-user <email> <displayName> [keyLabel], users, ops, set-user-status <userId> <ACTIVE|SUSPENDED>, keys <userId>, create-key <userId> [label], revoke-key <keyId>, requests [status], or decide <id> <status> [reason]',
  )
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await runPublicBetaAdmin()
}
