<template>
  <div class="container py-4">
    
    <div class="d-flex justify-content-between align-items-center mb-4 border-bottom pb-3">
      <h1 class="title mb-0">📈 台股資金流向儀表板</h1>
      
      <div class="d-flex align-items-center gap-2" v-if="availableDates.length > 0">
        <label class="fw-bold text-nowrap text-secondary">📅 歷史紀錄：</label>
        <select class="form-select w-auto fw-bold" v-model="selectedDate">
          <option v-for="d in availableDates" :key="d" :value="d">
            {{ formatDisplayDate(d) }}
          </option>
        </select>
      </div>
    </div>

    <div v-if="availableDates.length === 0" class="alert alert-warning text-center">
      目前資料庫尚無任何數據，請從 Python 桌面端點擊「一鍵推送」來上傳資料。
    </div>

    <div v-if="statsData.length > 0" class="data-section card shadow-sm">
      
      <div class="tabs-header d-flex border-bottom bg-light">
        <button class="tab-btn main-tab" :class="{ active: mainTab === '類股' }" @click="mainTab = '類股'">
          📊 類股平均數據
        </button>
        <button class="tab-btn main-tab" :class="{ active: mainTab === 'TOP30' }" @click="mainTab = 'TOP30'">
          🔥 成交額 Top 30
        </button>
      </div>

      <div v-if="mainTab === '類股'" class="p-3">
        <div class="d-flex justify-content-center gap-2 mb-3">
          <button class="btn btn-sm" :class="marketTab === '上市' ? 'btn-danger' : 'btn-outline-danger'" @click="marketTab = '上市'">上市類股</button>
          <button class="btn btn-sm" :class="marketTab === '上櫃' ? 'btn-primary' : 'btn-outline-primary'" @click="marketTab = '上櫃'">上櫃類股</button>
          <button class="btn btn-sm" :class="marketTab === '興櫃' ? 'btn-success' : 'btn-outline-success'" @click="marketTab = '興櫃'">興櫃類股</button>
        </div>

        <table class="table table-hover mt-2">
          <thead class="table-dark">
            <tr>
              <th>市場</th><th>類股名稱</th><th>平均漲跌幅</th><th>平均股價 (元)</th><th>平均成交量 (張)</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="stat in filteredStats" :key="stat.id">
              <td><span :class="['badge', getBadgeClass(stat.market)]">{{ stat.market }}</span></td>
              <td>{{ stat.category }}</td>
              <td :class="stat.avg_change_pct.includes('-') ? 'text-green' : 'text-red'">{{ stat.avg_change_pct }}</td>
              <td>{{ stat.avg_price }}</td>
              <td>{{ stat.avg_vol }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="mainTab === 'TOP30'" class="p-3">
        <table class="table table-hover mt-2">
          <thead class="table-warning">
            <tr>
              <th>排名</th><th>市場</th><th>代碼</th><th>名稱</th><th>估算成交金額 (千元)</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="stock in top30Data" :key="stock.id">
              <td><strong>#{{ stock.rank }}</strong></td>
              <td><span :class="['badge', getBadgeClass(stock.market)]">{{ stock.market }}</span></td>
              <td>{{ stock.ticker }}</td>
              <td>{{ stock.name }}</td>
              <td class="text-end fw-bold">{{ stock.total_value }}</td>
            </tr>
          </tbody>
        </table>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
const supabase = useSupabaseClient()

const mainTab = ref('類股')
const marketTab = ref('上市')
const statsData = ref([])
const top30Data = ref([])

// 歷史日期管理
const availableDates = ref([])
const selectedDate = ref('')

// 計算屬性：將 '20260310' 格式化為 '2026-03-10' 方便閱讀
const formatDisplayDate = (dateStr) => {
  if (!dateStr || dateStr.length !== 8) return dateStr
  return `${dateStr.substring(0,4)}-${dateStr.substring(4,6)}-${dateStr.substring(6,8)}`
}

// 過濾類股數據 (只顯示選中市場)
const filteredStats = computed(() => {
  return statsData.value.filter(stat => stat.market === marketTab.value)
})

// 1. 初始化：掃描資料庫有哪幾天
const fetchAvailableDates = async () => {
  // 只抓取 date 欄位以節省流量
  const { data, error } = await supabase.from('category_stats').select('date')
  if (!error && data) {
    // 利用 Set 去除重複日期，並由新到舊 (降序) 排列
    const uniqueDates = [...new Set(data.map(item => item.date))].sort((a, b) => b.localeCompare(a))
    availableDates.value = uniqueDates
    
    // 如果有資料且尚未選擇，預設選擇最新的一天
    if (uniqueDates.length > 0 && !selectedDate.value) {
      selectedDate.value = uniqueDates[0]
    }
  }
}

// 2. 根據被選擇的日期，去 Supabase 把當天的明細抓出來
const loadDataForDate = async (targetDate) => {
  if (!targetDate) return

  // 抓取當天類股
  const { data: sData } = await supabase
    .from('category_stats')
    .select('*')
    .eq('date', targetDate) // 精確鎖定日期

  if (sData) {
    statsData.value = sData.sort((a, b) => {
      const valA = parseFloat(a.avg_change_pct.replace('%', '')) || 0
      const valB = parseFloat(b.avg_change_pct.replace('%', '')) || 0
      return valB - valA
    })
  }

  // 抓取當天 Top 30
  const { data: tData } = await supabase
    .from('daily_top30')
    .select('*')
    .eq('date', targetDate) // 精確鎖定日期
    .order('rank', { ascending: true })

  if (tData) {
    top30Data.value = tData
  }
}

// 3. 監聽器：一旦下拉選單的日期改變，立刻觸發讀取新資料
watch(selectedDate, (newDate) => {
  loadDataForDate(newDate)
})

const getBadgeClass = (market) => {
  if (market === '上市') return 'bg-danger'
  if (market === '上櫃') return 'bg-primary'
  if (market === '興櫃') return 'bg-success'
  return 'bg-secondary'
}

onMounted(async () => {
  await fetchAvailableDates()
})
</script>

<style scoped>
@import url('https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css');
.container { font-family: '微軟正黑體', sans-serif; max-width: 900px; }
.title { font-weight: bold; color: #333; }
.text-red { color: #D32F2F; font-weight: bold; }
.text-green { color: #388E3C; font-weight: bold; }
.tab-btn { flex: 1; padding: 15px; background: none; border: none; font-size: 16px; font-weight: bold; color: #6c757d; cursor: pointer; transition: all 0.3s; }
.tab-btn:hover { background-color: #e9ecef; }
.tab-btn.active { color: #000; border-bottom: 4px solid #FF9800; background-color: #fff; }
</style>