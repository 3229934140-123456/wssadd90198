import { useMemo, useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { formatCurrency, paymentMethodLabels } from '../utils/rules'

export default function ShiftSummaryPage() {
  const currentShift = useAppStore((s) => s.currentShift)
  const transactions = useAppStore((s) => s.transactions)
  const abnormalAlerts = useAppStore((s) => s.abnormalAlerts)
  const clearAbnormalAlerts = useAppStore((s) => s.clearAbnormalAlerts)
  const cancelTransaction = useAppStore((s) => s.cancelTransaction)
  const incrementReceiptPrint = useAppStore((s) => s.incrementReceiptPrint)
  const closeShift = useAppStore((s) => s.closeShift)

  const [selectedTx, setSelectedTx] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [showCancel, setShowCancel] = useState(false)
  const [showSignature, setShowSignature] = useState(false)
  const [signatureTxId, setSignatureTxId] = useState<string | null>(null)
  const [shiftClosed, setShiftClosed] = useState(false)

  const shiftTxs = useMemo(() => {
    const start = new Date(currentShift.startedAt)
    const end = currentShift.endedAt ? new Date(currentShift.endedAt) : new Date('9999-12-31')
    return transactions
      .filter((t) => {
        const d = new Date(t.createdAt)
        return t.cashierId === currentShift.cashierId && d >= start && d <= end
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [transactions, currentShift])

  const abnormalTxs = useMemo(() => {
    return shiftTxs.filter((t) => t.warningFlags && t.warningFlags.length > 0)
  }, [shiftTxs])

  const handlePrint = (txId: string) => {
    incrementReceiptPrint(txId)
    alert('模拟打印小票：交易已打印')
  }

  const handleShowSignature = (txId: string) => {
    setSignatureTxId(txId)
    setShowSignature(true)
  }

  const handleCloseShift = () => {
    if (!confirm('确认交班？交班后当前班次数据将锁定并生成交班单。')) return
    closeShift()
    setShiftClosed(true)
  }

  const doCancel = () => {
    if (!selectedTx || !cancelReason.trim()) {
      alert('请填写取消原因')
      return
    }
    cancelTransaction(selectedTx, cancelReason)
    setShowCancel(false)
    setCancelReason('')
    setSelectedTx(null)
  }

  const shiftLabel =
    currentShift.shift === 'morning'
      ? '早班'
      : currentShift.shift === 'afternoon'
        ? '中班'
        : '晚班'

  const selectedTransaction = signatureTxId
    ? transactions.find((t) => t.id === signatureTxId)
    : null

  const otherPayTotal =
    currentShift.cashTotal +
    currentShift.cardTotal +
    currentShift.wechatTotal +
    currentShift.alipayTotal

  return (
    <div className="page-card">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 className="page-title" style={{ marginBottom: 4 }}>交班汇总</h1>
          <p className="page-subtitle" style={{ marginBottom: 0 }}>
            {currentShift.shiftDate} · {shiftLabel} · 收银员 <span className="text-bold">{currentShift.cashierName}</span>
            {currentShift.status === 'closed' && (
              <span className="tag tag-gray" style={{ marginLeft: 10 }}>已交班</span>
            )}
            {currentShift.status === 'active' && (
              <span className="tag tag-success" style={{ marginLeft: 10 }}>交班中</span>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {currentShift.status === 'active' && (
            <button className="btn btn-danger" onClick={handleCloseShift}>
              🔒 确认交班
            </button>
          )}
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">💰 现金</div>
          <div className="stat-value cash">{formatCurrency(currentShift.cashTotal)}</div>
          <div className="text-gray" style={{ fontSize: 12, marginTop: 4 }}>{currentShift.cashCount} 笔</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">💳 银行卡</div>
          <div className="stat-value card">{formatCurrency(currentShift.cardTotal)}</div>
          <div className="text-gray" style={{ fontSize: 12, marginTop: 4 }}>{currentShift.cardCount} 笔</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">💚 微信</div>
          <div className="stat-value wechat">{formatCurrency(currentShift.wechatTotal)}</div>
          <div className="text-gray" style={{ fontSize: 12, marginTop: 4 }}>{currentShift.wechatCount} 笔</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">🅰️ 支付宝</div>
          <div className="stat-value alipay">{formatCurrency(currentShift.alipayTotal)}</div>
          <div className="text-gray" style={{ fontSize: 12, marginTop: 4 }}>{currentShift.alipayCount} 笔</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">💎 储值扣款</div>
          <div className="stat-value stored">{formatCurrency(currentShift.storedDeductTotal)}</div>
          <div className="text-gray" style={{ fontSize: 12, marginTop: 4 }}>
            {currentShift.deductCount} 笔扣 / {currentShift.rechargeCount} 笔充
          </div>
        </div>
      </div>

      <div className="section">
        <h3 className="section-title">交班统计</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          <div style={{ background: '#f9fafb', padding: 16, borderRadius: 12, border: '1px solid #e5e7eb' }}>
            <div className="text-gray" style={{ fontSize: 13 }}>储值充值总额</div>
            <div className="text-green" style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>
              {formatCurrency(currentShift.rechargeTotal)}
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{currentShift.rechargeCount} 笔</div>
          </div>
          <div style={{ background: '#f9fafb', padding: 16, borderRadius: 12, border: '1px solid #e5e7eb' }}>
            <div className="text-gray" style={{ fontSize: 13 }}>项目消费总额</div>
            <div className="text-pink" style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>
              {formatCurrency(currentShift.storedDeductTotal + (otherPayTotal - currentShift.rechargeTotal > 0 ? otherPayTotal - currentShift.rechargeTotal : 0))}
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{currentShift.deductCount} 笔</div>
          </div>
          <div style={{ background: '#fef2f2', padding: 16, borderRadius: 12, border: '1px solid #fecaca' }}>
            <div className="text-gray" style={{ fontSize: 13 }}>退款总额</div>
            <div className="text-red" style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>
              {formatCurrency(currentShift.refundTotal)}
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{currentShift.refundCount} 笔</div>
          </div>
          <div style={{ background: '#fef3c7', padding: 16, borderRadius: 12, border: '1px solid #fde68a' }}>
            <div className="text-gray" style={{ fontSize: 13 }}>异常/预警</div>
            <div className="text-orange" style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>
              {abnormalTxs.length} 笔
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
              {currentShift.abnormalTransactions.length} 个风控标记
            </div>
          </div>
        </div>
      </div>

      {abnormalAlerts.length > 0 && (
        <div className="section">
          <h3 className="section-title">
            实时异常提醒
            <button
              className="btn btn-secondary btn-sm"
              onClick={clearAbnormalAlerts}
              style={{ marginLeft: 12, fontSize: 12, padding: '4px 10px' }}
            >
              全部标记已读
            </button>
          </h3>
          {abnormalAlerts.map((a) => (
            <div key={a.id} className={`alert ${a.level === 'danger' ? 'alert-danger' : 'alert-warning'}`}>
              <span className="alert-icon">
                {a.type === 'cancel' ? '🚫' : a.type === 'reprint' ? '🖨️' : a.type === 'adjust' ? '✏️' : '⚠️'}
              </span>
              <div style={{ flex: 1 }}>
                <div className="text-bold">{a.message}</div>
                <div style={{ fontSize: 12, marginTop: 2, opacity: 0.8 }}>
                  {a.timestamp} · {a.level === 'danger' ? '高危' : '一般'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {abnormalTxs.length > 0 && (
        <div className="section">
          <h3 className="section-title">异常交易单追溯</h3>
          <table className="table">
            <thead>
              <tr>
                <th>交易单号</th>
                <th>会员</th>
                <th>类型</th>
                <th>金额</th>
                <th>异常标记</th>
                <th>时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {abnormalTxs.map((tx) => (
                <tr key={tx.id}>
                  <td className="text-bold">{tx.transactionNo}</td>
                  <td>{tx.memberName}</td>
                  <td>
                    {tx.type === 'recharge' && <span className="tag tag-success">储值充值</span>}
                    {tx.type === 'deduct' && <span className="tag tag-info">项目扣款</span>}
                    {tx.type === 'refund' && <span className="tag tag-warning">退款</span>}
                  </td>
                  <td className={tx.type === 'recharge' ? 'text-green' : 'text-pink'}>{formatCurrency(tx.amount)}</td>
                  <td>
                    {(tx.warningFlags || []).map((f) => (
                      <span key={f} className="tag tag-warning" style={{ marginRight: 4 }}>{f}</span>
                    ))}
                  </td>
                  <td className="text-gray">{tx.createdAt}</td>
                  <td>
                    <button className="btn btn-secondary btn-sm" onClick={() => handleShowSignature(tx.id)}>
                      查看签字
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="section">
        <h3 className="section-title">本班次全部交易 ({shiftTxs.length} 笔)</h3>
        {shiftTxs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <div className="empty-text">当前班次暂无交易记录</div>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>交易单号</th>
                <th>会员</th>
                <th>类型</th>
                <th>金额</th>
                <th>支付方式</th>
                <th>状态</th>
                <th>套餐/项目</th>
                <th>打印次数</th>
                <th>时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {shiftTxs.map((tx) => (
                <tr key={tx.id} style={{ opacity: tx.status === 'cancelled' ? 0.55 : 1 }}>
                  <td className="text-bold">{tx.transactionNo}</td>
                  <td>
                    {tx.memberName}
                    {tx.warningFlags && tx.warningFlags.length > 0 && (
                      <div style={{ fontSize: 11, color: '#b45309' }}>⚠ 异常</div>
                    )}
                  </td>
                  <td>
                    {tx.type === 'recharge' && <span className="tag tag-success">储值充值</span>}
                    {tx.type === 'deduct' && <span className="tag tag-info">项目扣款</span>}
                    {tx.type === 'refund' && <span className="tag tag-warning">退款</span>}
                    {tx.type === 'adjust' && <span className="tag tag-purple">手工调账</span>}
                  </td>
                  <td className={`text-bold ${tx.type === 'recharge' ? 'text-green' : tx.type === 'refund' ? 'text-red' : 'text-pink'}`}>
                    {tx.type === 'recharge' ? '+' : tx.type === 'refund' ? '-' : ''}{formatCurrency(tx.amount)}
                  </td>
                  <td>{paymentMethodLabels[tx.paymentMethod]}</td>
                  <td>
                    <span className={`status-dot ${tx.status}`} />
                    {tx.status === 'completed' && '已完成'}
                    {tx.status === 'pending' && '处理中'}
                    {tx.status === 'cancelled' && '已取消'}
                    {tx.status === 'voided' && '已作废'}
                    {tx.cancelReason && (
                      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>原因：{tx.cancelReason}</div>
                    )}
                  </td>
                  <td>
                    {tx.packageName || (tx.items && tx.items.length > 0 ? (
                      <div style={{ fontSize: 12, color: '#374151' }}>
                        {tx.items.slice(0, 2).map((i) => (
                          <div key={i.id}>· {i.projectName}</div>
                        ))}
                        {tx.items.length > 2 && <div>· 等 {tx.items.length} 项</div>}
                      </div>
                    ) : '-')}
                  </td>
                  <td>
                    {tx.receiptPrintCount} 次
                    {tx.receiptPrintCount >= 3 && <span className="tag tag-warning" style={{ marginLeft: 4 }}>多次</span>}
                  </td>
                  <td className="text-gray" style={{ fontSize: 12 }}>{tx.createdAt.slice(5)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handlePrint(tx.id)}
                        style={{ padding: '6px 10px', fontSize: 12 }}
                      >
                        🖨️ 打印
                      </button>
                      {tx.signature && (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleShowSignature(tx.id)}
                          style={{ padding: '6px 10px', fontSize: 12 }}
                        >
                          ✍️ 签字
                        </button>
                      )}
                      {tx.status === 'completed' && currentShift.status === 'active' && (
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => { setSelectedTx(tx.id); setShowCancel(true) }}
                          style={{ padding: '6px 10px', fontSize: 12 }}
                        >
                          取消
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {shiftClosed && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{
            background: 'white', borderRadius: 16, padding: 36, width: 460, maxWidth: '90%',
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)', textAlign: 'center',
          }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>🔒</div>
            <h2 style={{ marginBottom: 8 }}>交班成功</h2>
            <p className="text-gray" style={{ marginBottom: 24 }}>
              {currentShift.shiftDate} {shiftLabel}已交班
            </p>
            <div style={{ background: '#f9fafb', padding: 18, borderRadius: 12, marginBottom: 24, textAlign: 'left' }}>
              <div className="summary-row"><span>本班交易总数</span><span>{currentShift.transactionCount} 笔</span></div>
              <div className="summary-row"><span>储值充值</span><span className="text-green">+{formatCurrency(currentShift.rechargeTotal)}</span></div>
              <div className="summary-row"><span>项目扣款</span><span className="text-pink">-{formatCurrency(currentShift.storedDeductTotal)}</span></div>
              <div className="summary-row"><span>现金+刷卡+扫码</span><span>{formatCurrency(otherPayTotal)}</span></div>
              <div className="summary-row"><span>异常单</span><span className="text-orange">{abnormalTxs.length} 笔</span></div>
            </div>
            <button className="btn btn-primary" onClick={() => setShiftClosed(false)}>
              确认
            </button>
          </div>
        </div>
      )}

      {showCancel && selectedTx && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{
            background: 'white', borderRadius: 16, padding: 28, width: 400,
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }}>
            <div style={{ fontSize: 40, textAlign: 'center', marginBottom: 12 }}>🚫</div>
            <h3 style={{ textAlign: 'center', marginBottom: 4 }}>取消交易</h3>
            <p className="text-gray" style={{ textAlign: 'center', fontSize: 13, marginBottom: 20 }}>
              取消后将回退储值余额，并记录异常
            </p>
            <div className="form-group">
              <label className="form-label">取消原因（必填）</label>
              <select className="form-select" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)}>
                <option value="">请选择原因</option>
                <option value="客户取消">客户取消</option>
                <option value="操作失误">操作失误</option>
                <option value="客户改约">客户改约</option>
                <option value="价格错误">价格/项目输入错误</option>
                <option value="其他">其他原因</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setShowCancel(false); setCancelReason(''); setSelectedTx(null) }}>返回</button>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={doCancel}>确认取消</button>
            </div>
          </div>
        </div>
      )}

      {showSignature && selectedTransaction && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{
            background: 'white', borderRadius: 16, padding: 24, width: 500,
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }}>
            <h3 style={{ marginBottom: 4 }}>顾客签字确认</h3>
            <p className="text-gray" style={{ fontSize: 13, marginBottom: 16 }}>
              交易单号：{selectedTransaction.transactionNo} · {selectedTransaction.memberName}
            </p>
            {selectedTransaction.signature ? (
              <div style={{
                border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden',
                background: '#fafafa',
              }}>
                <img src={selectedTransaction.signature} alt="签字" style={{ width: '100%', display: 'block' }} />
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>
                该交易无签字记录
              </div>
            )}
            <div style={{ textAlign: 'right', marginTop: 16 }}>
              <button className="btn btn-secondary" onClick={() => { setShowSignature(false); setSignatureTxId(null) }}>关闭</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
