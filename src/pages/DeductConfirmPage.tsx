import { useState, useRef, useEffect, useMemo } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import { formatCurrency, maskName, levelColorMap, paymentMethodLabels } from '../utils/rules'
import type { TransactionItem, PaymentMethod } from '../types'

interface DraftItem {
  id: string
  projectId: string
  projectName: string
  doctorId: string
  doctorName: string
  consultantId: string
  consultantName: string
  treatmentNo: string
  unitPrice: number
  quantity: number
}

const genItemId = () => 'item_' + Math.random().toString(36).slice(2, 10)
const genTreatmentNo = () => 'ZL' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + String(Math.floor(Math.random() * 1000)).padStart(3, '0')

export default function DeductConfirmPage() {
  const navigate = useNavigate()
  const currentMember = useAppStore((s) => s.currentMember)
  const projects = useAppStore((s) => s.projects)
  const doctors = useAppStore((s) => s.doctors)
  const consultants = useAppStore((s) => s.consultants)
  const createTransaction = useAppStore((s) => s.createTransaction)
  const setCurrentMember = useAppStore((s) => s.setCurrentMember)
  const addAbnormalAlert = useAppStore((s) => s.addAbnormalAlert)
  const currentCashier = useAppStore((s) => s.currentCashier)

  const [items, setItems] = useState<DraftItem[]>([
    {
      id: genItemId(),
      projectId: '',
      projectName: '',
      doctorId: '',
      doctorName: '',
      consultantId: consultants[0]?.id || '',
      consultantName: consultants[0]?.name || '',
      treatmentNo: genTreatmentNo(),
      unitPrice: 0,
      quantity: 1,
    },
  ])
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('stored')
  const [showSuccess, setShowSuccess] = useState(false)
  const [lastTxNo, setLastTxNo] = useState('')
  const [priceLocked, setPriceLocked] = useState<Record<string, boolean>>({})
  const [signature, setSignature] = useState('')
  const [hasSigned, setHasSigned] = useState(false)
  const [makeUpAmount, setMakeUpAmount] = useState(0)
  const [makeUpMethod, setMakeUpMethod] = useState<PaymentMethod>('wechat')

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawing = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })

  const itemsTotal = useMemo(() => {
    return items.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0)
  }, [items])

  const balance = currentMember?.balance || 0
  const storedAmount = Math.min(itemsTotal, balance)
  const needMakeUp = itemsTotal > balance
  const actualMakeUp = needMakeUp ? itemsTotal - balance : 0

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const ratio = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * ratio
    canvas.height = rect.height * ratio
    ctx.scale(ratio, ratio)
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#1f2937'
  }, [])

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0]?.clientX ?? 0 : (e as React.MouseEvent).clientX
    const clientY = 'touches' in e ? e.touches[0]?.clientY ?? 0 : (e as React.MouseEvent).clientY
    return { x: clientX - rect.left, y: clientY - rect.top }
  }

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    isDrawing.current = true
    lastPos.current = getPos(e)
  }
  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing.current) return
    e.preventDefault()
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const pos = getPos(e)
    ctx.beginPath()
    ctx.moveTo(lastPos.current.x, lastPos.current.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    lastPos.current = pos
    setHasSigned(true)
  }
  const endDraw = () => { isDrawing.current = false }

  const clearSignature = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasSigned(false)
    setSignature('')
  }

  const addItem = () => {
    setItems([
      ...items,
      {
        id: genItemId(),
        projectId: '',
        projectName: '',
        doctorId: '',
        doctorName: '',
        consultantId: consultants[0]?.id || '',
        consultantName: consultants[0]?.name || '',
        treatmentNo: genTreatmentNo(),
        unitPrice: 0,
        quantity: 1,
      },
    ])
  }

  const removeItem = (id: string) => {
    if (items.length <= 1) return
    setItems(items.filter((i) => i.id !== id))
  }

  const updateItem = (id: string, patch: Partial<DraftItem>) => {
    setItems(items.map((it) => {
      if (it.id !== id) return it
      const newItem = { ...it, ...patch }
      if (patch.projectId) {
        const p = projects.find((x) => x.id === patch.projectId)
        if (p) {
          newItem.projectName = p.name
          if (!priceLocked[id]) {
            newItem.unitPrice = p.price
          }
        }
      }
      if (patch.doctorId) {
        const d = doctors.find((x) => x.id === patch.doctorId)
        if (d) newItem.doctorName = d.name
      }
      if (patch.consultantId) {
        const c = consultants.find((x) => x.id === patch.consultantId)
        if (c) newItem.consultantName = c.name
      }
      return newItem
    }))
  }

  const handleUnitPriceChange = (id: string, newPrice: number, oldPrice: number) => {
    const proj = projects.find((p) => p.id === items.find((i) => i.id === id)?.projectId)
    if (proj && newPrice !== proj.price) {
      setPriceLocked({ ...priceLocked, [id]: true })
      addAbnormalAlert({
        type: 'adjust',
        message: `收银员 ${currentCashier.name} 手工调整项目「${proj.name}」价格：${formatCurrency(oldPrice)} → ${formatCurrency(newPrice)}`,
        cashierId: currentCashier.id,
        level: 'danger',
      })
    }
    updateItem(id, { unitPrice: newPrice })
  }

  const canSubmit = useMemo(() => {
    if (itemsTotal <= 0) return false
    for (const it of items) {
      if (!it.projectId || !it.doctorId || !it.consultantId || !it.treatmentNo || it.unitPrice <= 0 || it.quantity <= 0) {
        return false
      }
    }
    if (needMakeUp && actualMakeUp > 0 && !makeUpMethod) return false
    if (!hasSigned) return false
    return true
  }, [items, itemsTotal, needMakeUp, actualMakeUp, makeUpMethod, hasSigned])

  const handleSubmit = () => {
    if (!currentMember || !canSubmit) return
    const canvas = canvasRef.current
    const sigData = canvas ? canvas.toDataURL('image/png') : ''
    setSignature(sigData)

    const txItems: TransactionItem[] = items.map((it) => ({
      id: genItemId(),
      transactionId: '',
      projectId: it.projectId,
      projectName: it.projectName,
      doctorId: it.doctorId,
      doctorName: it.doctorName,
      consultantId: it.consultantId,
      consultantName: it.consultantName,
      treatmentNo: it.treatmentNo,
      unitPrice: it.unitPrice,
      quantity: it.quantity,
      amount: it.unitPrice * it.quantity,
    }))

    const firstConsultant = items.find((i) => i.consultantId)
    const consultantId = firstConsultant?.consultantId
    const consultantName = firstConsultant?.consultantName

    if (needMakeUp && actualMakeUp > 0) {
      const makeUpTx = createTransaction({
        type: 'recharge',
        memberId: currentMember.id,
        amount: actualMakeUp,
        paymentMethod: makeUpMethod,
        rechargePrincipal: actualMakeUp,
        rechargeGift: 0,
        remarks: '补差价充值',
        signature: sigData,
      })
      setMakeUpAmount(actualMakeUp)
    }

    const deductTx = createTransaction({
      type: 'deduct',
      memberId: currentMember.id,
      amount: itemsTotal,
      paymentMethod: needMakeUp ? 'stored' : paymentMethod,
      items: txItems,
      consultantId,
      consultantName,
      signature: sigData,
    })

    setLastTxNo(deductTx.transactionNo)
    setShowSuccess(true)
  }

  const backToMember = () => {
    setShowSuccess(false)
    const updatedMember = useAppStore.getState().members.find((m) => m.id === currentMember?.id) || null
    if (updatedMember) setCurrentMember(updatedMember)
    navigate('/member')
  }

  const goNewScan = () => {
    setShowSuccess(false)
    setCurrentMember(null)
    navigate('/scan')
  }

  if (!currentMember) {
    return <Navigate to="/scan" replace />
  }

  const levelInfo = levelColorMap[currentMember.level]

  if (showSuccess) {
    return (
      <div className="page-card" style={{ textAlign: 'center', paddingTop: 60 }}>
        <div style={{ fontSize: 80, marginBottom: 20 }}>✅</div>
        <h1 className="page-title" style={{ color: '#16a34a' }}>扣款成功</h1>
        <p className="page-subtitle">交易单号：<span className="text-bold">{lastTxNo}</span></p>

        <div style={{ maxWidth: 520, margin: '32px auto', background: '#f0fdf4', padding: 28, borderRadius: 16, border: '1px solid #bbf7d0', textAlign: 'left' }}>
          {makeUpAmount > 0 && (
            <div className="summary-row">
              <span>补差价充值（{paymentMethodLabels[makeUpMethod]}）</span>
              <span className="text-green text-bold">+{formatCurrency(makeUpAmount)}</span>
            </div>
          )}
          <div className="summary-row"><span>项目消费合计</span><span className="text-pink text-bold">-{formatCurrency(itemsTotal)}</span></div>
          <div className="summary-row"><span>其中：储值扣款</span><span className="text-bold">{formatCurrency(storedAmount)}</span></div>
          {makeUpAmount > 0 && (
            <div className="summary-row"><span>现金/电子支付补足</span><span className="text-bold">{formatCurrency(makeUpAmount)}</span></div>
          )}
          <div className="summary-row total">
            <span>新余额</span>
            <span className="amount">{formatCurrency(balance + makeUpAmount - itemsTotal)}</span>
          </div>
        </div>

        <p className="text-gray" style={{ marginBottom: 32 }}>
          会员 <span className="text-bold">{maskName(currentMember.name)}</span> 已完成本次诊疗结算
        </p>

        <div style={{ display: 'flex', gap: 14, justifyContent: 'center' }}>
          <button className="btn btn-secondary" onClick={backToMember}>返回会员详情</button>
          <button className="btn btn-primary" onClick={goNewScan}>继续服务下一位</button>
        </div>
      </div>
    )
  }

  return (
    <div className="page-card">
      <h1 className="page-title">扣款确认</h1>
      <p className="page-subtitle">选择本次诊疗项目、主治医生、咨询师和治疗单号，确认后扣卡或补缴</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 24 }}>
        <div>
          <div className="member-card" style={{ padding: 18, marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div className="member-avatar" style={{ width: 48, height: 48, fontSize: 20, borderRadius: 12 }}>
                {maskName(currentMember.name).charAt(0)}
              </div>
              <div>
                <div className="text-bold" style={{ fontSize: 16 }}>
                  {maskName(currentMember.name)}
                  <span className={`member-level-tag ${levelInfo.bg} ${levelInfo.text}`} style={{ marginLeft: 8 }}>
                    {levelInfo.label}
                  </span>
                </div>
                <div className="text-gray" style={{ fontSize: 12, marginTop: 2 }}>
                  {currentMember.memberCode} · 余额 <span className="text-pink text-bold">{formatCurrency(balance)}</span>
                  {balance < itemsTotal && itemsTotal > 0 && (
                    <span className="text-red text-bold" style={{ marginLeft: 10 }}>⚠ 余额不足 {formatCurrency(itemsTotal - balance)}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="section">
            <h3 className="section-title">诊疗项目明细</h3>
            {items.map((item, idx) => {
              const curProj = projects.find((p) => p.id === item.projectId)
              return (
                <div className="item-row" key={item.id}>
                  <div className="form-group">
                    <label className="form-label">项目 #{idx + 1}</label>
                    <select
                      className="form-select"
                      value={item.projectId}
                      onChange={(e) => updateItem(item.id, { projectId: e.target.value })}
                    >
                      <option value="">请选择项目</option>
                      {projects.filter((p) => p.isActive).map((p) => (
                        <option key={p.id} value={p.id}>{p.name}（{formatCurrency(p.price)}）</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">单价</label>
                    <input
                      type="number"
                      className="form-input"
                      value={item.unitPrice || ''}
                      onChange={(e) => handleUnitPriceChange(item.id, parseFloat(e.target.value) || 0, item.unitPrice)}
                      min="0"
                      step="10"
                      style={{ color: priceLocked[item.id] ? '#dc2626' : '#111827', fontWeight: priceLocked[item.id] ? 600 : 400 }}
                    />
                    {priceLocked[item.id] && (
                      <div className="mt-sm" style={{ fontSize: 11, color: '#dc2626' }}>⚠ 手工调整</div>
                    )}
                    {curProj && !priceLocked[item.id] && (
                      <div className="mt-sm" style={{ fontSize: 11, color: '#6b7280' }}>原价: {formatCurrency(curProj.price)}</div>
                    )}
                  </div>
                  <div className="form-group">
                    <label className="form-label">数量</label>
                    <input
                      type="number"
                      className="form-input"
                      value={item.quantity}
                      onChange={(e) => updateItem(item.id, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                      min="1"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">小计</label>
                    <div style={{ padding: '12px 0', fontSize: 16, fontWeight: 700, color: '#ec4899' }}>
                      {formatCurrency(item.unitPrice * item.quantity)}
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">主治医生</label>
                    <select
                      className="form-select"
                      value={item.doctorId}
                      onChange={(e) => updateItem(item.id, { doctorId: e.target.value })}
                    >
                      <option value="">请选择</option>
                      {doctors.map((d) => (
                        <option key={d.id} value={d.id}>{d.name} - {d.title}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'end' }}>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => removeItem(item.id)}
                      disabled={items.length <= 1}
                      style={{ marginBottom: 0 }}
                    >
                      ×
                    </button>
                  </div>
                </div>
              )
            })}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 6 }}>
              <div className="form-group">
                <label className="form-label">咨询师（共用）</label>
                <select
                  className="form-select"
                  value={items[0]?.consultantId || ''}
                  onChange={(e) => {
                    const cId = e.target.value
                    const c = consultants.find((x) => x.id === cId)
                    setItems(items.map((i) => ({ ...i, consultantId: cId, consultantName: c?.name || '' })))
                  }}
                >
                  <option value="">请选择</option>
                  {consultants.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">治疗单号（首个项目）</label>
                <input
                  type="text"
                  className="form-input"
                  value={items[0]?.treatmentNo || ''}
                  onChange={(e) => setItems(items.map((it, i) => i === 0 ? { ...it, treatmentNo: e.target.value } : it))}
                />
              </div>
            </div>

            <button className="btn btn-secondary btn-sm" onClick={addItem} style={{ marginTop: 6 }}>
              ＋ 添加项目
            </button>
          </div>

          <div className="section">
            <h3 className="section-title">顾客签字确认</h3>
            <div className="signature-pad" style={{ height: 160 }}>
              <canvas
                ref={canvasRef}
                style={{ width: '100%', height: 160 }}
                onMouseDown={startDraw}
                onMouseMove={draw}
                onMouseUp={endDraw}
                onMouseLeave={endDraw}
                onTouchStart={startDraw}
                onTouchMove={draw}
                onTouchEnd={endDraw}
              />
              {!hasSigned && <div className="signature-hint">请顾客在此签名确认</div>}
            </div>
            <button className="btn btn-secondary btn-sm" onClick={clearSignature} style={{ marginTop: 8 }}>
              🗑️ 清除签字
            </button>
          </div>
        </div>

        <div>
          <div className="summary-box" style={{ marginTop: 0 }}>
            <div className="summary-row"><span>项目数量</span><span className="text-bold">{items.length} 项</span></div>
            <div className="summary-row">
              <span>项目合计</span>
              <span className="text-bold">{formatCurrency(itemsTotal)}</span>
            </div>
            <div className="summary-row"><span>账户余额</span><span>{formatCurrency(balance)}</span></div>
            {balance >= itemsTotal ? (
              <div className="summary-row"><span>储值扣款</span><span className="text-pink text-bold">-{formatCurrency(itemsTotal)}</span></div>
            ) : (
              <>
                <div className="summary-row"><span>储值扣款（全部余额）</span><span className="text-pink text-bold">-{formatCurrency(balance)}</span></div>
                <div className="summary-row">
                  <span>需补缴差额</span>
                  <span className="text-red text-bold">{formatCurrency(actualMakeUp)}</span>
                </div>
                <div style={{ marginTop: 10 }}>
                  <div className="form-label">补缴方式</div>
                  <div className="payment-methods">
                    {(['wechat', 'alipay', 'card', 'cash'] as PaymentMethod[]).map((m) => (
                      <div
                        key={m}
                        className={`payment-method ${makeUpMethod === m ? 'selected' : ''}`}
                        onClick={() => setMakeUpMethod(m)}
                        style={{ padding: '8px 14px', fontSize: 13 }}
                      >
                        {paymentMethodLabels[m]}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="alert alert-info" style={{ marginTop: 14, marginBottom: 0 }}>
                  <span className="alert-icon">ℹ️</span>
                  <div style={{ fontSize: 12.5 }}>
                    将先以所选方式充值 <span className="text-bold">{formatCurrency(actualMakeUp)}</span> 补差价，再全额储值扣款。
                    <span className="text-red text-bold">禁止直接修改项目单价来免补缴！</span>
                  </div>
                </div>
              </>
            )}
            <div className="summary-row total">
              <span>扣后余额</span>
              <span className="amount">
                {formatCurrency(Math.max(0, balance - (balance >= itemsTotal ? itemsTotal : balance)))}
              </span>
            </div>
          </div>

          {balance < itemsTotal && itemsTotal > 0 && (
            <div className="summary-box" style={{ marginTop: 16, background: '#fef2f2', borderColor: '#fecaca' }}>
              <div className="summary-row">
                <span className="text-red text-bold">🔒 改价限制</span>
                <span></span>
              </div>
              <div style={{ fontSize: 12.5, color: '#991b1b', lineHeight: 1.8 }}>
                余额不足时<strong>禁止私自改价</strong>，必须引导顾客补缴。
                如确有特殊折扣，需主管授权并走审批流程。
              </div>
            </div>
          )}

          <div className="action-bar" style={{ marginTop: 20 }}>
            <button className="btn btn-secondary" onClick={() => navigate('/member')}>返回</button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={!canSubmit}>
              确认扣款
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
