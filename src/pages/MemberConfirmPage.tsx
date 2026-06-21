import { Navigate, useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import { maskName, maskPhone, formatCurrency, levelColorMap, paymentMethodLabels } from '../utils/rules'

export default function MemberConfirmPage() {
  const navigate = useNavigate()
  const currentMember = useAppStore((s) => s.currentMember)
  const transactions = useAppStore((s) => s.transactions)
  const setCurrentMember = useAppStore((s) => s.clearCurrentMember)

  if (!currentMember) {
    return <Navigate to="/scan" replace />
  }

  const memberTxs = transactions
    .filter((t) => t.memberId === currentMember.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5)

  const levelInfo = levelColorMap[currentMember.level]

  return (
    <div className="page-card">
      <h1 className="page-title">会员确认</h1>
      <p className="page-subtitle">请与顾客核对信息，确认无误后选择充值或扣款操作</p>

      <div className="member-card">
        <div className="member-card-top">
          <div style={{ display: 'flex', alignItems: 'flex-start' }}>
            <div className="member-avatar">{maskName(currentMember.name).charAt(0)}</div>
            <div className="member-info">
              <div className="member-name-row">
                <span className="member-name">{maskName(currentMember.name)}</span>
                <span className={`member-level-tag ${levelInfo.bg} ${levelInfo.text}`}>
                  {levelInfo.label}
                </span>
              </div>
              <div className="member-meta">
                <span>会员码：{currentMember.memberCode}</span>
                <span>手机号：{maskPhone(currentMember.phone)}</span>
                <span>注册：{currentMember.createdAt.slice(0, 10)}</span>
                {currentMember.lastConsumeAt && (
                  <span>最近消费：{currentMember.lastConsumeAt.slice(0, 10)}</span>
                )}
              </div>
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => { setCurrentMember(); navigate('/scan') }}>
            🔄 重新选择会员
          </button>
        </div>

        <div className="balance-grid">
          <div className="balance-item">
            <div className="balance-label">账户余额</div>
            <div className="balance-value highlight">{formatCurrency(currentMember.balance)}</div>
          </div>
          <div className="balance-item">
            <div className="balance-label">本金余额</div>
            <div className="balance-value green">{formatCurrency(currentMember.principal)}</div>
          </div>
          <div className="balance-item">
            <div className="balance-label">赠金余额</div>
            <div className="balance-value orange">{formatCurrency(currentMember.gift)}</div>
          </div>
          <div className="balance-item">
            <div className="balance-label">累计消费</div>
            <div className="balance-value">{formatCurrency(currentMember.totalConsume)}</div>
          </div>
        </div>
      </div>

      <div className="section">
        <h3 className="section-title">
          最近消费记录
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => navigate('/flow')}
            style={{ marginLeft: 12, fontSize: 12, padding: '4px 12px' }}
          >
            📋 查看完整账户流水
          </button>
        </h3>
        {memberTxs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <div className="empty-text">该会员暂无消费记录</div>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>交易单号</th>
                <th>类型</th>
                <th>金额</th>
                <th>支付方式</th>
                <th>状态</th>
                <th>时间</th>
                <th>收银员</th>
              </tr>
            </thead>
            <tbody>
              {memberTxs.map((tx) => (
                <tr key={tx.id}>
                  <td className="text-bold">{tx.transactionNo}</td>
                  <td>
                    {tx.type === 'recharge' && <span className="tag tag-success">储值充值</span>}
                    {tx.type === 'deduct' && <span className="tag tag-info">项目扣款</span>}
                    {tx.type === 'refund' && <span className="tag tag-warning">退款</span>}
                    {tx.type === 'adjust' && <span className="tag tag-purple">手工调账</span>}
                  </td>
                  <td className={tx.type === 'recharge' ? 'text-green' : 'text-pink'}>
                    {tx.type === 'recharge' ? '+' : '-'}{formatCurrency(tx.amount)}
                  </td>
                  <td>{paymentMethodLabels[tx.paymentMethod]}</td>
                  <td>
                    <span className={`status-dot ${tx.status}`} />
                    {tx.status === 'completed' && '已完成'}
                    {tx.status === 'pending' && '处理中'}
                    {tx.status === 'cancelled' && '已取消'}
                    {tx.status === 'voided' && '已作废'}
                  </td>
                  <td className="text-gray">{tx.createdAt}</td>
                  <td>{tx.cashierName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="section">
        <h3 className="section-title">选择操作</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, maxWidth: 720, margin: '0 auto' }}>
          <button
            className="btn btn-primary btn-lg"
            onClick={() => navigate('/recharge')}
            style={{ padding: '40px 24px', flexDirection: 'column', gap: 12 }}
          >
            <span style={{ fontSize: 48 }}>💰</span>
            <span style={{ fontSize: 18 }}>储值充值</span>
            <span style={{ fontSize: 13, opacity: 0.9 }}>顾客充值、补差价</span>
          </button>
          <button
            className="btn btn-secondary btn-lg"
            onClick={() => navigate('/deduct')}
            style={{ padding: '40px 24px', flexDirection: 'column', gap: 12, border: '2px solid #e5e7eb', background: 'white' }}
          >
            <span style={{ fontSize: 48 }}>🧾</span>
            <span style={{ fontSize: 18 }}>项目扣款</span>
            <span style={{ fontSize: 13, color: '#6b7280' }}>诊疗完成后扣卡结算</span>
          </button>
        </div>
      </div>
    </div>
  )
}
