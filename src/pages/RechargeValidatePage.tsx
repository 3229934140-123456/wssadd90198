import { useState, useRef, useEffect, useMemo } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import { checkRechargeRules, formatCurrency, maskName, levelColorMap, paymentMethodLabels } from '../utils/rules'
import type { Package, PaymentMethod } from '../types'

export default function RechargeValidatePage() {
  const navigate = useNavigate()
  const currentMember = useAppStore((s) => s.currentMember)
  const packages = useAppStore((s) => s.packages)
  const transactions = useAppStore((s) => s.transactions)
  const currentCashier = useAppStore((s) => s.currentCashier)
  const createTransaction = useAppStore((s) => s.createTransaction)
  const setCurrentMember = useAppStore((s) => s.setCurrentMember)

  const [selectedPkg, setSelectedPkg] = useState<Package | null>(null)
  const [customAmount, setCustomAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card')
  const [signature, setSignature] = useState('')
  const [hasSigned, setHasSigned] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [lastTxNo, setLastTxNo] = useState('')
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [approvalPwd, setApprovalPwd] = useState('')
  const [showApproval, setShowApproval] = useState(false)

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
      return { passed: true, warnings: [], requiresApproval: false, approvalLevel: 'none' as const }
    }
    return checkRechargeRules(rechargeAmount, selectedPkg, currentMember, transactions, currentCashier.id)
  }, [currentMember, selectedPkg, rechargeAmount, transactions, currentCashier.id])

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

  const endDraw = () => {
    isDrawing.current = false
  }

  const clearSignature = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasSigned(false)
    setSignature('')
  }

  const handleSubmit = async () => {
    if (!currentMember) return
    if (rechargeAmount <= 0) return
    if (!paymentMethod) return
    if (!agreeTerms) {
      alert('请先确认充值协议和退款说明')
      return
    }
    if (!hasSigned) {
      alert('请让顾客在签字板上签名确认')
      return
    }

    if (ruleResult.requiresApproval) {
      setShowApproval(true)
      return
    }

    doSubmit()
  }

  const handleApproval = () => {
    if (approvalPwd === '123456' || approvalPwd === '888888') {
      setShowApproval(false)
      setApprovalPwd('')
      doSubmit()
    } else {
      alert('授权密码错误，请联系主管')
    }
  }

  const doSubmit = () => {
    if (!currentMember) return
    const canvas = canvasRef.current
    const sigData = canvas ? canvas.toDataURL('image/png') : ''
    setSignature(sigData)

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
      remarks: ruleResult.warnings.length > 0 ? `规则预警: ${ruleResult.warnings.join('; ')}` : undefined,
    })

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

  if (showSuccess) {
    return (
      <div className="page-card" style={{ textAlign: 'center', paddingTop: 60 }}>
        <div style={{ fontSize: 80, marginBottom: 20 }}>✅</div>
        <h1 className="page-title" style={{ color: '#16a34a' }}>储值成功</h1>
        <p className="page-subtitle">交易单号：<span className="text-bold">{lastTxNo}</span></p>

        <div style={{ maxWidth: 480, margin: '32px auto', background: '#f0fdf4', padding: 28, borderRadius: 16, border: '1px solid #bbf7d0' }}>
          <div className="summary-row"><span>储值本金</span><span className="text-bold">{formatCurrency(rechargeAmount)}</span></div>
          <div className="summary-row"><span>赠送金额</span><span className="text-green text-bold">+{formatCurrency(giftAmount)}</span></div>
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

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 24 }}>
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
                  {currentMember.memberCode} · 当前余额 <span className="text-pink text-bold">{formatCurrency(currentMember.balance)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="section">
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
            <div className="section">
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

          <div className="section">
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

          {ruleResult.warnings.length > 0 && (
            <div className="section">
              <h3 className="section-title">规则预警</h3>
              {ruleResult.warnings.map((w, i) => (
                <div key={i} className={`alert ${ruleResult.approvalLevel === 'manager' ? 'alert-danger' : 'alert-warning'}`}>
                  <span className="alert-icon">{ruleResult.approvalLevel === 'manager' ? '🛑' : '⚠️'}</span>
                  <div>
                    <div className="text-bold">{w}</div>
                    <div style={{ fontSize: 12, marginTop: 4, opacity: 0.8 }}>
                      {ruleResult.approvalLevel === 'manager' ? '需要店经理授权（密码 888888）' : '需要主管授权（密码 123456）'}
                    </div>
                  </div>
                </div>
              ))}
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
              <div className="signature-pad" style={{ height: 180 }}>
                <canvas
                  ref={canvasRef}
                  style={{ width: '100%', height: 180 }}
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
              disabled={rechargeAmount <= 0 || !paymentMethod || !agreeTerms || !hasSigned}
            >
              确认储值
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
            background: 'white', borderRadius: 16, padding: 32, width: 400,
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }}>
            <div style={{ fontSize: 48, textAlign: 'center', marginBottom: 16 }}>🔐</div>
            <h3 style={{ textAlign: 'center', marginBottom: 8 }}>需要授权审批</h3>
            <p style={{ textAlign: 'center', color: '#6b7280', fontSize: 13, marginBottom: 20 }}>
              本次操作触发风控规则，需要{ruleResult.approvalLevel === 'manager' ? '店经理' : '主管'}授权
              <br />
              <span style={{ fontSize: 12 }}>（演示密码：主管123456 / 经理888888）</span>
            </p>
            <div className="form-group">
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
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setShowApproval(false); setApprovalPwd('') }}>取消</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleApproval}>确认授权</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
