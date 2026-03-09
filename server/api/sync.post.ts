import { serverSupabaseServiceRole } from '#supabase/server'

export default defineEventHandler(async (event) => {
  // 1. 驗證 Token 安全性
  const headers = getHeaders(event)
  const authHeader = headers['authorization']
  const expectedToken = `Bearer ${process.env.API_SYNC_TOKEN}`

  if (authHeader !== expectedToken) {
    throw createError({ statusCode: 401, statusMessage: '身分驗證失敗：Token 錯誤' })
  }

  // 2. 讀取 Python 傳來的 JSON
  const body = await readBody(event)
  const date = body.date
  const stats = body.yahoo_stats || []
  const top30 = body.yahoo_top30 || []

  // 3. 使用 Service Role 繞過 RLS 寫入資料庫
  const supabase = await serverSupabaseServiceRole(event)

  try {
    // 為了保持儀表板為「最新狀態」，先清空舊資料
    await supabase.from('category_stats').delete().neq('id', 0)
    await supabase.from('daily_top30').delete().neq('id', 0)

    // 準備寫入格式
    const statsPayload = stats.map((s: any) => ({
      date, market: s.market, category: s.category,
      avg_change_pct: s.avg_change_pct, avg_price: s.avg_price, avg_vol: s.avg_vol
    }))

    const top30Payload = top30.map((t: any) => ({
      date, rank: t.rank, ticker: t.ticker, name: t.name,
      market: t.market, total_value: t.total_value
    }))

    // 批次寫入
    if (statsPayload.length > 0) {
      const { error } = await supabase.from('category_stats').insert(statsPayload)
      if (error) throw error
    }

    if (top30Payload.length > 0) {
      const { error } = await supabase.from('daily_top30').insert(top30Payload)
      if (error) throw error
    }

    return { success: true, message: `成功同步 ${date} 的資料` }
  } catch (error: any) {
    throw createError({ statusCode: 500, statusMessage: `資料庫寫入失敗: ${error.message}` })
  }
})