import { useState, useRef, useEffect, useMemo } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import {
  checkRechargeRules,
  formatCurrency,
  maskName,
  maskPhone,
  levelColorMap,
  paymentMethodLabels,
  riskLevelConfig,
} from '../utils/rules'
import type { Package, PaymentMethod, RiskLevel, ApprovalLevel } from '../types'

export default function RechargeValidatePage() {
  const navigate = useNavigate()
  const currentMember = useAppStore((s) => s.currentMember)
  const packages = useAppStore((s) => s.packages)
  const transactions = useAppStore((s) => s.transactions)
  const currentCashier = useAppStore((s) => s.currentCashier)
  const createTransaction = useAppStore((s) => s.createTransaction)
  const addAbnormalAlert = useAppStore((s) => s.addAbnormalAlert)
  const setCurrentMember = useAppStore((s) => s.setCurrentMember)

  const [selectedPkg, setSelectedPkg] = useState<Package | null>(null)
  const [customAmount, setCustomAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card')
  const [hasSigned, setHasSigned] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [lastTxNo, setLastTxNo] = useState('')
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [showApproval, setShowApproval] = useState(false)
  const [approvalPwd, setApprovalPwd] = useState('')
  const [approvalReason, setApprovalReason] = useState('')

  const [isThirdPartyPayer, setIsThirdPartyPayer] = useState(false)
  const [payerName, setPayerName] = useState('')
  const [payerPhone, setPayerPhone] = useState('')
  const [payerRelation, setPayerRelation] = useState('')

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawing = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })

  const rechargeAmount = useMemo(() => {
    if (selectedPkg) return selectedPkg.packagePrice
    const n = parseFloat(customAmount)
    return isNaN(n) ? 0 : n
  }, [selectedPkg, customAmount])

  const giftAmount = useMemo(() => {
    if (selectedPkg) return selectedPkg.giftAmount
    const n = rechargeAmount
    if (n >= 100000) return Math.floor(n * 0.5)
    if (n >= 50000) return Math.floor(n * 0.36)
    if (n >= 30000) return Math.floor(n * 0.26)
    if (n >= 10000) return Math.floor(n * 0.2)
    if (n >= 5000) return Math.floor(n * 0.16)
    return 0
  }, [selectedPkg, rechargeAmount])

  const ruleResult = useMemo(() => {
    if (!currentMember || rechargeAmount <= 0) {
      return {
        passed: true,
        overallRiskLevel: 'low' as RiskLevel,
        warnings: [] as string[],
        ruleDetails: [],
        suggestions: [] as string[],
        requiresApproval: false,
        approvalLevel: 'none' as ApprovalLevel,
      }
    }
    const payerPhoneForCheck = isThirdPartyPayer && payerPhone ? payerPhone : undefined
    return checkRechargeRules(
      rechargeAmount,
      selectedPkg,
      currentMember,
      transactions,
      currentCashier.id,
      payerPhoneForCheck,
      payerName || undefined,
    )
  }, [currentMember, selectedPkg, rechargeAmount, transactions, currentCashier.id, isThirdPartyPayer, payerPhone, payerName])

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

  const handleSubmit = () => {
    if (!currentMember) return
    if (rechargeAmount <= 0) return
    if (!paymentMethod) return
    if (!agreeTerms) { alert('请先确认充值协议和退款说明'); return }
    if (!hasSigned) { alert('请让顾客在签字板上签名确认'); return }
    if (isThirdPartyPayer && (!payerName.trim() || !payerPhone.trim())) {
      alert('请填写代付人姓名和手机号'); return
    }

    if (ruleResult.requiresApproval) {
      setShowApproval(true)
      return
    }

    doSubmit()
  }

  const handleApproval = () => {
    const isSupervisor = approvalPwd === '123456'
    const isManager = approvalPwd === '888888'

    if (!isSupervisor && !isManager) {
      alert('授权密码错误，请联系主管')
      return
    }

    const requiredLevel = ruleResult.approvalLevel
    if (requiredLevel === 'manager' && !isManager) {
      alert('此交易需要店经理授权，请联系店经理')
      return
    }
    if (!approvalReason.trim()) {
      alert('请填写授权原因')
      return
    }

    setShowApproval(false)
    setApprovalPwd('')
    doSubmit(isManager ? 'manager' : 'supervisor', isManager ? '刘店总' : '张主管', isManager ? 'm001' : 's001')
  }

  const doSubmit = (
    approvalLevel?: ApprovalLevel,
    approverName?: string,
    approverId?: string,
  ) => {
    if (!currentMember) return
    const canvas = canvasRef.current
    const sigData = canvas ? canvas.toDataURL('image/png') : ''

    const approvalRecords = approvalLevel && approverName && approverId
      ? [{
          approverId,
          approverName,
          approvalLevel,
          approvalType: (ruleResult.overallRiskLevel === 'critical' ? 'large_recharge' : 'low_price') as 'large_recharge' | 'low_price',
          reason: approvalReason || '风控授权通过',
        }]
      : []

    const actualPayerName = isThirdPartyPayer ? payerName.trim() : currentMember.name
    const actualPayerPhone = isThirdPartyPayer ? payerPhone.trim() : currentMember.phone

    const tx = createTransaction({
      type: 'recharge',
      memberId: currentMember.id,
      amount: rechargeAmount,
      paymentMethod,
      packageId: selectedPkg?.id,
      packageName: selectedPkg?.name,
      rechargePrincipal: rechargeAmount,
      rechargeGift: giftAmount,
      signature: sigData,
      payerName: actualPayerName,
      payerPhone: actualPayerPhone,
      isThirdPartyPayer,
      riskLevel: ruleResult.overallRiskLevel,
      riskDetails: ruleResult.warnings.length > 0 ? ruleResult.warnings : undefined,
      warningFlags: ruleResult.warnings.length > 0 ? ruleResult.warnings : undefined,
      approvalRecords,
      remarks: approvalReason ? `授权原因: ${approvalReason}` : undefined,
    })

    if (ruleResult.overallRiskLevel === 'high' || ruleResult.overallRiskLevel === 'critical') {
      addAbnormalAlert({
        type: ruleResult.overallRiskLevel === 'critical' ? 'large_amount' : 'low_price',
        message: `储值 ${formatCurrency(rechargeAmount)} 触发${riskLevelConfig[ruleResult.overallRiskLevel].label}，会员：${currentMember.name}`,
        transactionId: tx.id,
        cashierId: currentCashier.id,
        level: ruleResult.overallRiskLevel === 'critical' ? 'danger' : 'warning',
      })
    }
    if (isThirdPartyPayer) {
      addAbnormalAlert({
        type: 'multi_payer',
        message: `代付储值：付款人 ${payerName} 为会员 ${currentMember.name} 支付 ${formatCurrency(rechargeAmount)}`,
        transactionId: tx.id,
        cashierId: currentCashier.id,
        level: 'warning',
      })
    }

    setLastTxNo(tx.transactionNo)
    setShowSuccess(true)
  }

  const backToMember = () => {
    setShowSuccess(false)
    setSelectedPkg(null)
    setCustomAmount('')
    setAgreeTerms(false)
    clearSignature()
    const updatedMember = useAppStore.getState().members.find((m) => m.id === currentMember?.id) || null
    if (updatedMember) setCurrentMember(updatedMember)
    navigate('/member')
  }

  const goNewScan = () => {
    setShowSuccess(false)
    setSelectedPkg(null)
    setCustomAmount('')
    setAgreeTerms(false)
    clearSignature()
    setCurrentMember(null)
    navigate('/scan')
  }

  if (!currentMember) {
    return <Navigate to="/scan" replace />
  }

  const levelInfo = levelColorMap[currentMember.level]
  const riskCfg = riskLevelConfig[ruleResult.overallRiskLevel]

  if (showSuccess) {
    return (
      <div className="page-card" style={{ textAlign: 'center', paddingTop: 60 }}>
        <div style={{ fontSize: 80, marginBottom: 20 }}>✅</div>
        <h1 className="page-title" style={{ color: '#16a34a' }}>储值成功</h1>
        <p className="page-subtitle">交易单号：<span className="text-bold">{lastTxNo}</span></p>

        <div style={{ maxWidth: 480, margin: '32px auto', background: '#f0fdf4', padding: 28, borderRadius: 16, border: '1px solid #bbf7d0' }}>
          <div className="summary-row"><span>储值本金</span><span className="text-bold">{formatCurrency(rechargeAmount)}</span></div>
          <div className="summary-row"><span>赠送金额</span><span className="text-green text-bold">+{formatCurrency(giftAmount)}</span></div>
          {isThirdPartyPayer && (
            <div className="summary-row"><span>代付人</span><span className="text-bold">{maskName(payerName)} ({maskPhone(payerPhone)})</span></div>
          )}
          <div className="summary-row total">
            <span>本次入账总额</span>
            <span className="amount">{formatCurrency(rechargeAmount + giftAmount)}</span>
          </div>
        </div>

        <p className="text-gray" style={{ marginBottom: 32 }}>
          会员 <span className="text-bold">{maskName(currentMember.name)}</span> 新余额：
          <span className="text-pink text-bold" style={{ fontSize: 18, marginLeft: 8 }}>
            {formatCurrency(currentMember.balance)}
          </span>
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
      <h1 className="page-title">储值校验</h1>
      <p className="page-subtitle">录入储值信息，系统自动校验大额、低价囤卡、代付等风控规则</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 24 }}>
        <div>
          <div className="member-card" style={{ padding: 18, marginBottom: 20 }}>
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
                  {currentMember.memberCode} · 余额 <span className="text-pink text-bold">{formatCurrency(currentMember.balance)}</span>
                  · 本金 {formatCurrency(currentMember.principal)} · 赠金 {formatCurrency(currentMember.gift)}
                </div>
              </div>
            </div>
          </div>

          <div className="section" style={{ marginBottom: 20 }}>
            <h3 className="section-title">选择活动套餐</h3>
            <div className="packages-grid">
              {packages.filter((p) => p.isActive).map((pkg) => (
                <div
                  key={pkg.id}
                  className={`package-card ${selectedPkg?.id === pkg.id ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedPkg(selectedPkg?.id === pkg.id ? null : pkg)
                    if (selectedPkg?.id !== pkg.id) setCustomAmount('')
                  }}
                >
                  <div className="package-name">{pkg.name}</div>
                  <div className="package-price-row">
                    <span className="package-price">{formatCurrency(pkg.packagePrice)}</span>
                    <span className="package-original">{formatCurrency(pkg.originalPrice)}</span>
                  </div>
                  <span className="package-gift">赠 {formatCurrency(pkg.giftAmount)}</span>
                </div>
              ))}
            </div>
          </div>

          {!selectedPkg && (
            <div className="section" style={{ marginBottom: 20 }}>
              <h3 className="section-title">或自定义储值金额</h3>
              <div className="form-group">
                <input
                  type="number"
                  className="form-input"
                  placeholder="请输入储值金额（元）"
                  value={customAmount}
                  onChange={(e) => { setCustomAmount(e.target.value); setSelectedPkg(null) }}
                  style={{ fontSize: 20, padding: '16px 20px', fontWeight: 600 }}
                  min="0"
                  step="100"
                />
                {rechargeAmount > 0 && giftAmount > 0 && (
                  <div className="mt-sm text-green text-bold">
                    系统自动赠金：+{formatCurrency(giftAmount)}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="section" style={{ marginBottom: 20 }}>
            <h3 className="section-title">支付方式</h3>
            <div className="payment-methods">
              {(['card', 'cash', 'wechat', 'alipay'] as PaymentMethod[]).map((m) => (
                <div
                  key={m}
                  className={`payment-method ${paymentMethod === m ? 'selected' : ''}`}
                  onClick={() => setPaymentMethod(m)}
                >
                  <span>{m === 'card' ? '💳' : m === 'cash' ? '💵' : m === 'wechat' ? '💚' : '🅰️'}</span>
                  {paymentMethodLabels[m]}
                </div>
              ))}
            </div>
          </div>

          <div className="section" style={{ marginBottom: 20 }}>
            <h3 className="section-title">
              付款人信息
              <span className="text-gray" style={{ fontWeight: 400, fontSize: 12, marginLeft: 8 }}>
                （非本人付款请登记，便于风控追溯）
              </span>
            </h3>
            <div style={{ marginBottom: 14 }}>
              <label className="form-label">
                <input
                  type="checkbox"
                  checked={isThirdPartyPayer}
                  onChange={(e) => setIsThirdPartyPayer(e.target.checked)}
                  style={{ marginRight: 8 }}
                />
                非会员本人付款（代付登记）
              </label>
            </div>

            {isThirdPartyPayer && (
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12,
                padding: 16, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12,
              }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">代付人姓名</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="请输入姓名"
                    value={payerName}
                    onChange={(e) => setPayerName(e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">手机号</label>
                  <input
                    type="tel"
                    className="form-input"
                    placeholder="请输入手机号"
                    value={payerPhone}
                    onChange={(e) => setPayerPhone(e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">与会员关系</label>
                  <select
                    className="form-select"
                    value={payerRelation}
                    onChange={(e) => setPayerRelation(e.target.value)}
                  >
                    <option value="">请选择</option>
                    <option value="亲属">亲属</option>
                    <option value="朋友">朋友</option>
                    <option value="同事">同事</option>
                    <option value="其他">其他</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {ruleResult.ruleDetails.length > 0 && rechargeAmount > 0 && (
            <div className="section" style={{ marginBottom: 20 }}>
              <h3 className="section-title">
                风控规则校验
                <span
                  className={`tag ${riskCfg.bg} ${riskCfg.text}`}
                  style={{ marginLeft: 10, fontSize: 13, padding: '4px 12px' }}
                >
                  <span
                    style={{
                      display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                      background: riskCfg.dot, marginRight: 6, verticalAlign: 'middle',
                    }}
                  />
                  {ruleResult.passed ? '全部通过' : riskCfg.label}
                </span>
              </h3>

              <div style={{ display: 'grid', gap: 8 }}>
                {ruleResult.ruleDetails.map((rule) => {
                  const cfg = riskLevelConfig[rule.riskLevel]
                  return (
                    <div
                      key={rule.key}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: 12,
                        padding: 12, borderRadius: 10,
                        background: rule.passed ? '#f9fafb' : cfg.bg,
                        border: `1px solid ${rule.passed ? '#e5e7eb' : 'transparent'}`,
                      }}
                    >
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: rule.passed ? '#dcfce7' : cfg.dot, color: 'white',
                        fontSize: 14, fontWeight: 700,
                      }}>
                        {rule.passed ? '✓' : '!'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span className="text-bold" style={{ fontSize: 14 }}>{rule.name}</span>
                          {!rule.passed && (
                            <span className={`tag ${cfg.bg} ${cfg.text}`} style={{ fontSize: 11 }}>
                              {cfg.label}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 13, color: '#4b5563' }}>{rule.message}</div>
                        {!rule.passed && rule.suggestion && (
                          <div style={{ fontSize: 12, marginTop: 4, color: '#6b7280' }}>
                            💡 处理建议：{rule.suggestion}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {ruleResult.suggestions.length > 0 && (
                <div className="alert alert-info" style={{ marginTop: 12, marginBottom: 0 }}>
                  <span className="alert-icon">📋</span>
                  <div>
                    <div className="text-bold" style={{ marginBottom: 4 }}>综合处理建议</div>
                    <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13, lineHeight: 1.8 }}>
                      {ruleResult.suggestions.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <div className="summary-box" style={{ marginTop: 0 }}>
            <h3 className="section-title" style={{ marginTop: 0 }}>充值协议与签字确认</h3>
            <div
              style={{
                background: '#f9fafb',
                border: '1px solid #e5e7eb',
                borderRadius: 10,
                padding: 14,
                fontSize: 12.5,
                lineHeight: 1.8,
                color: '#4b5563',
                marginBottom: 14,
                maxHeight: 180,
                overflow: 'auto',
              }}
            >
              <p className="text-bold" style={{ marginBottom: 8, color: '#1f2937' }}>《储值充值协议》</p>
              <p>1. 本人自愿选择上述储值套餐，确认本金和赠金金额无误。</p>
              <p>2. 储值金仅限本人使用，赠金部分不兑现、不找零、不开具发票。</p>
              <p>3. 退款说明：如申请退款，仅退还剩余本金部分，已享受赠金及优惠需扣除。</p>
              <p>4. 已消费项目按原价计算后扣除，剩余本金原路退回，到账时间约7-15个工作日。</p>
              <p>5. 储值有效期为最后一次充值日起3年，超期未消费将冻结账户。</p>
              <p>6. 本人已阅读并理解本协议全部条款，自愿承担相应消费风险。</p>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label className="form-label">
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  style={{ marginRight: 8 }}
                />
                我已阅读并同意《储值充值协议》及退款说明
              </label>
            </div>

            <div className="form-group">
              <div className="form-label">顾客签字确认 <span className="text-gray" style={{ fontWeight: 400 }}>（请让顾客在此签字）</span></div>
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
                {!hasSigned && <div className="signature-hint">请在此处签名</div>}
              </div>
              <button className="btn btn-secondary btn-sm" onClick={clearSignature} style={{ marginTop: 8 }}>
                🗑️ 清除签字
              </button>
            </div>
          </div>

          <div className="summary-box">
            <div className="summary-row"><span>储值本金</span><span className="text-bold">{formatCurrency(rechargeAmount)}</span></div>
            <div className="summary-row"><span>赠送金额</span><span className="text-green text-bold">+{formatCurrency(giftAmount)}</span></div>
            <div className="summary-row"><span>支付方式</span><span>{paymentMethodLabels[paymentMethod]}</span></div>
            {isThirdPartyPayer && (
              <div className="summary-row"><span>代付人</span><span className="text-bold">{payerName || '待填写'}</span></div>
            )}
            {ruleResult.requiresApproval && (
              <div className="summary-row">
                <span>授权级别</span>
                <span className={`tag ${ruleResult.approvalLevel === 'manager' ? 'tag-danger' : 'tag-warning'}`}>
                  {ruleResult.approvalLevel === 'manager' ? '店经理授权' : '主管授权'}
                </span>
              </div>
            )}
            <div className="summary-row total">
              <span>本次实付</span>
              <span className="amount">{formatCurrency(rechargeAmount)}</span>
            </div>
          </div>

          <div className="action-bar" style={{ marginTop: 20 }}>
            <button className="btn btn-secondary" onClick={() => navigate('/member')}>返回</button>
            <button
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={
                rechargeAmount <= 0 ||
                !paymentMethod ||
                !agreeTerms ||
                !hasSigned ||
                (isThirdPartyPayer && (!payerName.trim() || !payerPhone.trim()))
              }
            >
              {ruleResult.requiresApproval ? '需授权后确认' : '确认储值'}
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
            <h3 style={{ textAlign: 'center', marginBottom: 4 }}>风控授权</h3>
            <p style={{ textAlign: 'center', color: '#6b7280', fontSize: 13, marginBottom: 6 }}>
              本次操作触发 <span className={`tag ${riskCfg.bg} ${riskCfg.text}`} style={{ fontSize: 12 }}>{riskCfg.label}</span> 规则
            </p>
            <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: 12, marginBottom: 20 }}>
              需要{ruleResult.approvalLevel === 'manager' ? '店经理' : '主管'}现场授权
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
                <option value="其他">其他原因</option>
              </select>
            </div>
            {ruleResult.warnings.slice(0, 2).map((w, i) => (
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
