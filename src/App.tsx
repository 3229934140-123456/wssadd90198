import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom'
import { useAppStore } from './store/useAppStore'
import ScanPage from './pages/ScanPage'
import MemberConfirmPage from './pages/MemberConfirmPage'
import RechargeValidatePage from './pages/RechargeValidatePage'
import DeductConfirmPage from './pages/DeductConfirmPage'
import ShiftSummaryPage from './pages/ShiftSummaryPage'

const navItems = [
  { key: 'scan', label: '扫码识别', path: '/scan', num: 1, icon: '📷' },
  { key: 'member', label: '会员确认', path: '/member', num: 2, icon: '👤' },
  { key: 'recharge', label: '储值校验', path: '/recharge', num: 3, icon: '💰' },
  { key: 'deduct', label: '扣款确认', path: '/deduct', num: 4, icon: '✅' },
  { key: 'shift', label: '交班汇总', path: '/shift', num: 5, icon: '📊' },
]

export default function App() {
  const navigate = useNavigate()
  const location = useLocation()
  const currentCashier = useAppStore((s) => s.currentCashier)
  const abnormalAlerts = useAppStore((s) => s.abnormalAlerts)
  const currentShift = useAppStore((s) => s.currentShift)

  const currentKey = location.pathname.split('/')[1] || 'scan'

  const shiftLabel =
    currentShift.shift === 'morning'
      ? '早班'
      : currentShift.shift === 'afternoon'
        ? '中班'
        : '晚班'

  return (
    <div className="app-container">
      <div className="header">
        <div className="logo">
          <div className="logo-icon">💎</div>
          <span>医美储值校验系统</span>
        </div>
        <div className="header-info">
          <span className="shift">
            {currentShift.shiftDate} · {shiftLabel}
          </span>
          {abnormalAlerts.length > 0 && (
            <span
              onClick={() => navigate('/shift')}
              style={{
                background: 'rgba(239, 68, 68, 0.25)',
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: 13,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              ⚠️ 异常提醒 {abnormalAlerts.length}
            </span>
          )}
          <span className="cashier">
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              {currentCashier.name.charAt(0)}
            </div>
            <span>{currentCashier.name}</span>
            <span style={{ opacity: 0.8, fontSize: 12 }}>({currentCashier.code})</span>
          </span>
        </div>
      </div>

      <div className="nav">
        {navItems.map((item) => {
          const isActive = currentKey === item.key || (item.key === 'member' && (currentKey === 'recharge' || currentKey === 'deduct'))
          return (
            <div
              key={item.key}
              className={`nav-item ${item.key === currentKey ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              <span className="step-num">{item.num}</span>
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </div>
          )
        })}
        <div style={{ flex: 1 }} />
      </div>

      <div className="main-content">
        <Routes>
          <Route path="/" element={<Navigate to="/scan" replace />} />
          <Route path="/scan" element={<ScanPage />} />
          <Route path="/member" element={<MemberConfirmPage />} />
          <Route path="/recharge" element={<RechargeValidatePage />} />
          <Route path="/deduct" element={<DeductConfirmPage />} />
          <Route path="/shift" element={<ShiftSummaryPage />} />
          <Route path="*" element={<Navigate to="/scan" replace />} />
        </Routes>
      </div>
    </div>
  )
}
