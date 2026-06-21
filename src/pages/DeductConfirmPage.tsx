import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import {
  formatCurrency,
  maskName,
  levelColorMap,
  paymentMethodLabels,
  checkDiscountRules,
  riskLevelConfig,
  calcValueDiscountRatio,
} from '../utils/rules'
import type { TransactionItem, PaymentMethod, ApprovalRecord, DiscountDetail, RiskLevel } from '../types'

interface DraftItem {
  id: string
  projectId: string
  projectName: string
  doctorId: string
  doctorName: string
  consultantId: string
  consultantName: string
  treatmentNo: string
  originalPrice: number
  unitPrice: number
  quantity: number
  discountLocked: boolean
}

interface ApprovalState {
  level: 'supervisor' | 'manager'
  approverId: string
  approverName: string
  reason: string
  originalTotal: number
  approvedTotal: number
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
      originalPrice: 0,
      unitPrice: 0,
      quantity: 1,
      discountLocked: false,
    },
  ])
  const [showSuccess, setShowSuccess] = useState(false)
  const [lastTxNo, setLastTxNo] = useState('')
  const [hasSigned, setHasSigned] = useState(false)
  const [makeUpMethod, setMakeUpMethod] = useState<PaymentMethod>('wechat')

  const [showApproval, setShowApproval] = useState(false)
  const [approvalPwd, setApprovalPwd] = useState('')
  const [approvalReason, setApprovalReason] = useState('')

  const [approvalHistory, setApprovalHistory] = useState<ApprovalState[]>([])
  const [needReApproval, setNeedReApproval] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawing = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })

  const originalTotal = useMemo(() => {
    return items.reduce((sum, it) => sum + it.originalPrice * it.quantity, 0)
  }, [items])

  const itemsTotal = useMemo(() => {
    return items.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0)
  }, [items])

  const totalDiscount = useMemo(() => originalTotal - itemsTotal, [originalTotal, itemsTotal])
  const hasDiscount = totalDiscount > 0

  const discountCheck = useMemo(() => {
    const txItems: TransactionItem[] = items.map((it) => ({
      id: it.id,
      transactionId: '',
      projectId: it.projectId,
      projectName: it.projectName,
      doctorId: it.doctorId,
      doctorName: it.doctorName,
      consultantId: it.consultantId,
      consultantName: it.consultantName,
      treatmentNo: it.treatmentNo,
      originalPrice: it.originalPrice,
      unitPrice: it.unitPrice,
      quantity: it.quantity,
      amount: it.unitPrice * it.quantity,
      discountAmount: (it.originalPrice - it.unitPrice) * it.quantity,
      discountRatio: it.originalPrice > 0 ? it.unitPrice / it.originalPrice : 1,
    }))
    return checkDiscountRules(originalTotal, itemsTotal, txItems)
  }, [items, originalTotal, itemsTotal])

  const latestApproval = useMemo(() => {
    return approvalHistory.length > 0 ? approvalHistory[approvalHistory.length - 1] : null
  }, [approvalHistory])

  const currentApprovalLevel = useMemo(() => {
    if (!latestApproval) return 'none' as const
    return latestApproval.level
  }, [latestApproval])

  useEffect(() => {
    if (!hasDiscount) {
      setApprovalHistory([])
      setNeedReApproval(false)
      return
    }
    if (!latestApproval) {
      setNeedReApproval(true)
      return
    }
    const requiredLevel = discountCheck.approvalLevel
    const currentLevel = currentApprovalLevel
    if (requiredLevel === 'manager' && currentLevel !== 'manager') {
      setNeedReApproval(true)
    } else {
      setNeedReApproval(false)
    }
  }, [hasDiscount, discountCheck.approvalLevel, currentApprovalLevel, latestApproval])

  const balance = currentMember?.balance || 0
  const needMakeUp = itemsTotal > balance
  const actualMakeUp = needMakeUp ? itemsTotal - balance : 0

  const principalUsed = useMemo(() => {
    if (!currentMember) return 0
    const afterMakeUp = needMakeUp ? balance : itemsTotal
    let remain = afterMakeUp
    const gift = Math.min(remain, currentMember.gift)
    remain -= gift
    return remain + (needMakeUp ? actualMakeUp : 0)
  }, [itemsTotal, currentMember, needMakeUp, actualMakeUp, balance])

  const giftUsed = useMemo(() => {
    if (!currentMember) return 0
    return Math.min(itemsTotal - actualMakeUp, currentMember.gift)
  }, [itemsTotal, currentMember, actualMakeUp])

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
        originalPrice: 0,
        unitPrice: 0,
        quantity: 1,
        discountLocked: false,
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
          if (!it.discountLocked) {
            newItem.originalPrice = p.price
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

  const handleUnitPriceChange = (id: string, newPrice: number) => {
    if (!latestApproval) {
      alert('价格已锁定，如需特殊折扣请先申请授权')
      return
    }
    const item = items.find((i) => i.id === id)
    if (!item) return
    if (newPrice > item.originalPrice) {
      alert('折扣价不能高于原价')
      return
    }
    if (newPrice < 0) return
    updateItem(id, { unitPrice: newPrice, discountLocked: true })
  }

  const openDiscountApproval = () => {
    if (items.every((i) => !i.projectId)) {
      alert('请先选择项目')
      return
    }
    setShowApproval(true)
  }

  const handleApproval = () => {
    const isSupervisor = approvalPwd === '123456'
    const isManager = approvalPwd === '888888'

    if (!isSupervisor && !isManager) {
      alert('授权密码错误，请联系主管')
      return
    }

    const requiredLevel = discountCheck.approvalLevel
    if (requiredLevel === 'manager' && !isManager) {
      alert('此折扣力度需要店经理授权，请联系店经理')
      return
    }
    if (!approvalReason.trim()) {
      alert('请填写授权原因')
      return
    }

    const newApproval: ApprovalState = {
      level: isManager ? 'manager' : 'supervisor',
      approverId: isManager ? 'm001' : 's001',
      approverName: isManager ? '刘店总' : '张主管',
      reason: approvalReason,
      originalTotal,
      approvedTotal: itemsTotal,
    }
    setApprovalHistory([...approvalHistory, newApproval])
    setShowApproval(false)
    setApprovalPwd('')
    setApprovalReason('')
    setNeedReApproval(false)
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
    if (hasDiscount && !latestApproval) return false
    if (needReApproval) return false
    return true
  }, [items, itemsTotal, needMakeUp, actualMakeUp, makeUpMethod, hasSigned, hasDiscount, latestApproval, needReApproval])

  const handleSubmit = () => {
    if (!currentMember || !canSubmit) return
    const canvas = canvasRef.current
    const sigData = canvas ? canvas.toDataURL('image/png') : ''

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
      originalPrice: it.originalPrice,
      unitPrice: it.unitPrice,
      quantity: it.quantity,
      amount: it.unitPrice * it.quantity,
      discountAmount: (it.originalPrice - it.unitPrice) * it.quantity,
      discountRatio: it.originalPrice > 0 ? it.unitPrice / it.originalPrice : 1,
      discountApprovalId: latestApproval ? 'appr_' + it.id : undefined,
    }))

    const firstConsultant = items.find((i) => i.consultantId)
    const consultantId = firstConsultant?.consultantId
    const consultantName = firstConsultant?.consultantName

    const approvalRecords: ApprovalRecord[] = approvalHistory.map((a, idx) => ({
      id: 'appr_' + Date.now() + '_' + idx,
      transactionId: '',
      approverId: a.approverId,
      approverName: a.approverName,
      approvalLevel: a.level,
      approvalType: 'price_adjust' as const,
      reason: a.reason,
      originalValue: a.originalTotal,
      newValue: a.approvedTotal,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
    }))

    const valueDiscountRatio = hasDiscount ? calcValueDiscountRatio(itemsTotal, originalTotal) : undefined

    const discountDetail: DiscountDetail | undefined = hasDiscount
      ? {
          originalAmount: originalTotal,
          discountAmount: totalDiscount,
          finalAmount: itemsTotal,
          discountRatio: originalTotal > 0 ? itemsTotal / originalTotal : 1,
          valueDiscountRatio,
          authorizationType: latestApproval?.level || 'none',
          authorizedById: latestApproval?.approverId,
          authorizedByName: latestApproval?.approverName,
          authorizationReason: approvalHistory.map((a) => `${a.approverName}: ${a.reason}`).join('; '),
        }
      : undefined

    const deductTx = createTransaction({
      type: 'deduct',
      memberId: currentMember.id,
      amount: itemsTotal,
      paymentMethod: 'stored',
      items: txItems,
      consultantId,
      consultantName,
      signature: sigData,
      approvalRecords,
      discountDetail,
      principalUsed,
      giftUsed,
      makeUpAmount: needMakeUp ? actualMakeUp : undefined,
      makeUpMethod: needMakeUp ? makeUpMethod : undefined,
      riskLevel: discountCheck.riskLevel,
      riskDetails: discountCheck.warnings,
      warningFlags: hasDiscount
        ? ['手工调整金额', ...discountCheck.warnings]
        : undefined,
    })

    if (hasDiscount && latestApproval) {
      addAbnormalAlert({
        type: 'discount',
        message: `项目扣款折扣 ${latestApproval.approverName} 授权：${formatCurrency(originalTotal)} → ${formatCurrency(itemsTotal)}，会员：${currentMember.name}`,
        transactionId: deductTx.id,
        cashierId: currentCashier.id,
        level: discountCheck.riskLevel === 'critical' || discountCheck.riskLevel === 'high' ? 'danger' : 'warning',
      })
    }

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
  const riskCfg = riskLevelConfig[discountCheck.riskLevel]

  if (showSuccess) {
    const newBalance = currentMember.balance + actualMakeUp - itemsTotal
    return (
      <div className="page-card" style={{ textAlign: 'center', paddingTop: 60 }}>
        <div style={{ fontSize: 80, marginBottom: 20 }}>✅</div>
        <h1 className="page-title" style={{ color: '#16a34a' }}>扣款成功</h1>
        <p className="page-subtitle">交易单号：<span className="text-bold">{lastTxNo}</span></p>

        <div style={{ maxWidth: 520, margin: '32px auto', background: '#f0fdf4', padding: 28, borderRadius: 16, border: '1px solid #bbf7d0', textAlign: 'left' }}>
          {hasDiscount && (
            <div className="summary-row">
              <span>原价合计</span>
              <span className="text-gray" style={{ textDecoration: 'line-through' }}>{formatCurrency(originalTotal)}</span>
            </div>
          )}
          {hasDiscount && (
            <div className="summary-row">
              <span>优惠折扣</span>
              <span className="text-red text-bold">-{formatCurrency(totalDiscount)}</span>
            </div>
          )}
          <div className="summary-row"><span>项目消费合计</span><span className="text-pink text-bold">-{formatCurrency(itemsTotal)}</span></div>
          <div className="summary-row"><span>其中：本金扣款</span><span className="text-bold">{formatCurrency(principalUsed)}</span></div>
          <div className="summary-row"><span>其中：赠金抵扣</span><span className="text-green text-bold">{formatCurrency(giftUsed)}</span></div>
          {actualMakeUp > 0 && (
            <div className="summary-row">
              <span>补差价（{paymentMethodLabels[makeUpMethod]}）</span>
              <span className="text-bold">{formatCurrency(actualMakeUp)}</span>
            </div>
          )}
          {latestApproval && (
            <div className="summary-row">
              <span>折扣授权（{approvalHistory.length} 次授权）</span>
              <span className="text-orange text-bold">{latestApproval.approverName}</span>
            </div>
          )}
          <div className="summary-row total">
            <span>新余额</span>
            <span className="amount">{formatCurrency(newBalance)}</span>
          </div>
          <div style={{ marginTop: 10, fontSize: 12, color: '#6b7280' }}>
            本金 {formatCurrency(currentMember.principal + actualMakeUp - principalUsed)} + 赠金 {formatCurrency(currentMember.gift - giftUsed)} = {formatCurrency(newBalance)}
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
                  （本金 {formatCurrency(currentMember.principal)} + 赠金 {formatCurrency(currentMember.gift)}）
                  {balance < itemsTotal && itemsTotal > 0 && (
                    <span className="text-red text-bold" style={{ marginLeft: 10 }}>⚠ 余额不足 {formatCurrency(itemsTotal - balance)}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 className="section-title" style={{ marginBottom: 0 }}>诊疗项目明细</h3>
              <button
                className="btn btn-warning btn-sm"
                onClick={openDiscountApproval}
                style={{ fontSize: 12, padding: '6px 14px' }}
              >
                🔓 申请特殊折扣
              </button>
            </div>

            {latestApproval && !needReApproval && (
              <div className="alert alert-warning" style={{ marginBottom: 14 }}>
                <span className="alert-icon">✅</span>
                <div>
                  <div className="text-bold">
                    已获授权：{latestApproval.approverName}（{latestApproval.level === 'manager' ? '店经理' : '主管'}）
                  </div>
                  <div style={{ fontSize: 12, marginTop: 2 }}>授权原因：{latestApproval.reason}</div>
                  {approvalHistory.length > 1 && (
                    <div style={{ fontSize: 12, marginTop: 2, color: '#92400e' }}>
                      累计 {approvalHistory.length} 次授权（改价后可能触发更高级别）
                    </div>
                  )}
                </div>
              </div>
            )}

            {needReApproval && latestApproval && (
              <div style={{
                background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10,
                padding: 14, marginBottom: 14,
              }}>
                <div className="text-red text-bold" style={{ marginBottom: 6 }}>
                  ⚠ 折扣力度已超出当前授权范围，需要重新授权！
                </div>
                <div style={{ fontSize: 12, color: '#991b1b' }}>
                  当前折扣触发 <span className={`tag ${riskCfg.bg} ${riskCfg.text}`} style={{ fontSize: 11 }}>{riskCfg.label}</span>，
                  需要{discountCheck.approvalLevel === 'manager' ? '店经理' : '主管'}重新授权
                </div>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={openDiscountApproval}
                  style={{ marginTop: 8, fontSize: 12 }}
                >
                  🔐 重新申请授权
                </button>
              </div>
            )}

            {items.map((item, idx) => {
              const curProj = projects.find((p) => p.id === item.projectId)
              const itemDiscount = item.originalPrice > 0 && item.unitPrice < item.originalPrice
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
                    <label className="form-label">
                      单价
                      {!latestApproval && item.projectId && (
                        <span className="text-gray" style={{ fontWeight: 400, marginLeft: 6, fontSize: 11 }}>
                          🔒 已锁定
                        </span>
                      )}
                    </label>
                    <input
                      type="number"
                      className="form-input"
                      value={item.unitPrice || ''}
                      onChange={(e) => handleUnitPriceChange(item.id, parseFloat(e.target.value) || 0)}
                      min="0"
                      step="10"
                      readOnly={!latestApproval || needReApproval}
                      style={{
                        color: itemDiscount ? '#dc2626' : '#111827',
                        fontWeight: itemDiscount ? 600 : 400,
                        background: (!latestApproval || needReApproval) ? '#f3f4f6' : 'white',
                        cursor: (!latestApproval || needReApproval) ? 'not-allowed' : 'text',
                      }}
                    />
                    {item.originalPrice > 0 && item.unitPrice !== item.originalPrice && (
                      <div className="mt-sm" style={{ fontSize: 11, color: '#dc2626' }}>
                        ⚠ 原价 {formatCurrency(item.originalPrice)}，优惠 {formatCurrency(item.originalPrice - item.unitPrice)}
                      </div>
                    )}
                    {curProj && item.unitPrice === item.originalPrice && (
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

          {hasDiscount && discountCheck.warnings.length > 0 && (
            <div className="section" style={{ marginTop: 20 }}>
              <h3 className="section-title">
                折扣风险提示
                <span className={`tag ${riskCfg.bg} ${riskCfg.text}`} style={{ marginLeft: 10, fontSize: 12 }}>
                  {riskCfg.label}
                </span>
              </h3>
              <div style={{ display: 'grid', gap: 8 }}>
                {discountCheck.warnings.map((w, i) => (
                  <div key={i} style={{
                    padding: '10px 14px',
                    background: riskCfg.bg,
                    borderRadius: 8,
                    fontSize: 13,
                    color: '#4b5563',
                  }}>
                    ⚠️ {w}
                  </div>
                ))}
              </div>
              {discountCheck.suggestions.length > 0 && (
                <div className="alert alert-info" style={{ marginTop: 12, marginBottom: 0 }}>
                  <span className="alert-icon">💡</span>
                  <div>
                    <div className="text-bold" style={{ marginBottom: 4 }}>处理建议</div>
                    <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13, lineHeight: 1.8 }}>
                      {discountCheck.suggestions.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="section" style={{ marginTop: 20 }}>
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
            {hasDiscount && (
              <div className="summary-row">
                <span>原价合计</span>
                <span className="text-gray" style={{ textDecoration: 'line-through' }}>{formatCurrency(originalTotal)}</span>
              </div>
            )}
            {hasDiscount && (
              <div className="summary-row">
                <span>优惠折扣</span>
                <span className="text-red text-bold">-{formatCurrency(totalDiscount)}</span>
              </div>
            )}
            <div className="summary-row"><span>项目数量</span><span className="text-bold">{items.length} 项</span></div>
            <div className="summary-row">
              <span>项目合计</span>
              <span className="text-bold">{formatCurrency(itemsTotal)}</span>
            </div>
            <div className="summary-row"><span>账户余额</span><span>{formatCurrency(balance)}</span></div>
            <div className="summary-row"><span>其中：本金</span><span>{formatCurrency(currentMember.principal)}</span></div>
            <div className="summary-row"><span>其中：赠金</span><span className="text-green">{formatCurrency(currentMember.gift)}</span></div>
            {!needMakeUp ? (
              <>
                <div className="summary-row"><span>储值扣款（本金）</span><span className="text-pink text-bold">-{formatCurrency(principalUsed)}</span></div>
                <div className="summary-row"><span>赠金抵扣</span><span className="text-green text-bold">-{formatCurrency(giftUsed)}</span></div>
              </>
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
                    补缴 {formatCurrency(actualMakeUp)} 直接入本金后扣款，<strong>只产生一笔交易记录</strong>。
                    <div style={{ marginTop: 4, lineHeight: 1.6 }}>
                      本金 +{formatCurrency(actualMakeUp)} → 扣本金 {formatCurrency(principalUsed)}，扣赠金 {formatCurrency(giftUsed)}
                    </div>
                    <div className="text-red text-bold" style={{ marginTop: 4 }}>🔒 禁止直接修改项目单价来免补缴！</div>
                  </div>
                </div>
              </>
            )}
            <div className="summary-row total">
              <span>扣后余额</span>
              <span className="amount">
                {formatCurrency(balance + actualMakeUp - itemsTotal)}
              </span>
            </div>
            {needMakeUp && (
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                = 本金 {formatCurrency(currentMember.principal + actualMakeUp - principalUsed)} + 赠金 {formatCurrency(currentMember.gift - giftUsed)}
              </div>
            )}
          </div>

          {!latestApproval && (
            <div className="summary-box" style={{ marginTop: 16, background: '#fef2f2', borderColor: '#fecaca' }}>
              <div className="summary-row">
                <span className="text-red text-bold">🔒 价格锁定</span>
                <span></span>
              </div>
              <div style={{ fontSize: 12.5, color: '#991b1b', lineHeight: 1.8 }}>
                项目单价默认锁定，<strong>禁止前台私自改价</strong>。
                余额不足时必须引导顾客补缴。
                <br />如确有特殊折扣，需点击上方「申请特殊折扣」按钮，
                由主管/经理授权后方可改价。
                <br />改价后若折扣力度超出已授权范围，需重新申请更高级别授权。
              </div>
            </div>
          )}

          {approvalHistory.length > 0 && (
            <div className="summary-box" style={{ marginTop: 16, background: '#f5f3ff', borderColor: '#ddd6fe' }}>
              <div className="summary-row">
                <span className="text-bold" style={{ color: '#5b21b6' }}>🔐 授权记录</span>
                <span className="tag tag-purple" style={{ fontSize: 11 }}>{approvalHistory.length} 次授权</span>
              </div>
              {approvalHistory.map((a, idx) => (
                <div key={idx} style={{ fontSize: 12, marginTop: 6, color: '#6b7280', borderBottom: idx < approvalHistory.length - 1 ? '1px solid #e9d5ff' : 'none', paddingBottom: 6 }}>
                  <span className="text-bold">{a.approverName}</span>（{a.level === 'manager' ? '店经理' : '主管'}）
                  {formatCurrency(a.originalTotal)} → {formatCurrency(a.approvedTotal)}，
                  原因：{a.reason}
                </div>
              ))}
            </div>
          )}

          <div className="action-bar" style={{ marginTop: 20 }}>
            <button className="btn btn-secondary" onClick={() => navigate('/member')}>返回</button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={!canSubmit}>
              {needReApproval ? '需重新授权' : '确认扣款'}
            </button>
          </div>
        </div>
      </div>

      {showApproval && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{
            background: 'white', borderRadius: 16, padding: 28, width: 440,
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }}>
            <div style={{ fontSize: 44, textAlign: 'center', marginBottom: 12 }}>🔐</div>
            <h3 style={{ textAlign: 'center', marginBottom: 4 }}>
              {needReApproval ? '重新授权' : '折扣授权'}
            </h3>
            <p style={{ textAlign: 'center', color: '#6b7280', fontSize: 13, marginBottom: 6 }}>
              当前折扣力度触发 <span className={`tag ${riskCfg.bg} ${riskCfg.text}`} style={{ fontSize: 12 }}>{riskCfg.label}</span>
            </p>
            {needReApproval && (
              <p style={{ textAlign: 'center', color: '#dc2626', fontSize: 12, marginBottom: 6 }}>
                之前授权后折扣力度已加大，需更高级别授权
              </p>
            )}
            <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: 12, marginBottom: 20 }}>
              需要{discountCheck.approvalLevel === 'manager' ? '店经理' : '主管'}现场授权
              <br />（演示密码：主管 123456 / 店经理 888888）
            </p>
            <div className="form-group">
              <label className="form-label">授权密码</label>
              <input
                type="password"
                className="form-input"
                placeholder="请输入授权密码"
                value={approvalPwd}
                onChange={(e) => setApprovalPwd(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleApproval()}
                autoFocus
              />
            </div>
            <div className="form-group">
              <label className="form-label">授权原因</label>
              <select
                className="form-select"
                value={approvalReason}
                onChange={(e) => setApprovalReason(e.target.value)}
              >
                <option value="">请选择授权原因</option>
                <option value="老客户特惠">老客户特惠</option>
                <option value="活动促销">活动促销期间</option>
                <option value="大客户维护">大客户维护</option>
                <option value="投诉安抚">投诉安抚</option>
                <option value="员工内部价">员工内部价</option>
                <option value="其他">其他原因</option>
              </select>
            </div>
            {discountCheck.warnings.slice(0, 2).map((w, i) => (
              <div key={i} style={{ fontSize: 12, color: '#b45309', background: '#fffbeb', padding: '8px 12px', borderRadius: 8, marginBottom: 6 }}>
                ⚠️ {w}
              </div>
            ))}
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setShowApproval(false); setApprovalPwd('') }}>取消</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleApproval}>确认授权</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
