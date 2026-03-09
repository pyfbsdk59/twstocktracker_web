<template>
  <div class="container py-4">
    <h1 class="title text-center">📈 台股資金流向 Web 儀表板</h1>
    <p class="text-center text-muted" v-if="lastUpdate">最後更新日期：{{ lastUpdate }}</p>

    <div class="data-section card shadow-sm mt-4">
      
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
          <thead class="bg-warning">
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
import { ref, computed, onMounted } from 'vue'
const supabase = useSupabaseClient()

const mainTab = ref('類股')
const marketTab = ref('上市')
const statsData = ref([])
const top30Data = ref([])
const lastUpdate = ref('')

// 過濾類股數據
const filteredStats = computed(() => {
  return statsData.value.filter(stat => stat.market === marketTab.value)
})

// 取得資料
const fetchData = async () => {
  // 抓類股
  const { data: sData } = await supabase.from('category_stats').select('*')
  if (sData && sData.length > 0) {
    lastUpdate.value = sData[0].date
    statsData.value = sData.sort((a, b) => {
      const valA = parseFloat(a.avg_change_pct.replace('%', '')) || 0
      const valB = parseFloat(b.avg_change_pct.replace('%', '')) || 0
      return valB - valA
    })
  }

  // 抓 Top 30
  const { data: tData } = await supabase.from('daily_top30').select('*').order('rank', { ascending: true })
  if (tData) {
    top30Data.value = tData
  }
}

const getBadgeClass = (market) => {
  if (market === '上市') return 'bg-danger'
  if (market === '上櫃') return 'bg-primary'
  if (market === '興櫃') return 'bg-success'
  return 'bg-secondary'
}

onMounted(() => {
  fetchData()
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