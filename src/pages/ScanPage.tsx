import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import { maskName, formatCurrency } from '../utils/rules'

export default function ScanPage() {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const findMemberByCode = useAppStore((s) => s.findMemberByCode)
  const setCurrentMember = useAppStore((s) => s.setCurrentMember)
  const members = useAppStore((s) => s.members)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleScan = () => {
    setError('')
    const trimmed = code.trim()
    if (!trimmed) {
      setError('请输入或扫描会员码')
      return
    }
    const member = findMemberByCode(trimmed)
    if (!member) {
      setError(`未找到会员码为 "${trimmed}" 的会员，请核对`)
      return
    }
    setCurrentMember(member)
    navigate('/member')
  }

  const handleQuickSelect = (memberCode: string) => {
    setCode(memberCode)
    setTimeout(() => {
      const member = findMemberByCode(memberCode)
      if (member) {
        setCurrentMember(member)
        navigate('/member')
      }
    }, 100)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleScan()
    }
  }

  return (
    <div className="page-card">
      <h1 className="page-title">扫码识别</h1>
      <p className="page-subtitle">使用扫码枪扫描顾客会员码，或手动输入会员编号</p>

      <div className="scan-box">
        <div className="scan-icon-wrap">
          <div className="scan-big-text">📷</div>
        </div>

        <div className="form-group">
          <input
            ref={inputRef}
            type="text"
            className="form-input"
            placeholder="请扫描或输入会员码，如 VIP202401001"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{ fontSize: 18, padding: '16px 20px', textAlign: 'center' }}
          />
        </div>

        {error && (
          <div className="alert alert-danger">
            <span className="alert-icon">✕</span>
            <span>{error}</span>
          </div>
        )}

        <button className="btn btn-primary btn-lg" onClick={handleScan} style={{ width: '100%', marginTop: 12 }}>
          <span>🔍</span> 识别会员
        </button>

        <p style={{ marginTop: 20, fontSize: 13, color: '#9ca3af' }}>
          提示：按 Enter 键快速识别
        </p>
      </div>

      <div className="section" style={{ marginTop: 48 }}>
        <h3 className="section-title">快捷选择会员（演示用）</h3>
        <div className="quick-list">
          {members.map((m) => (
            <div key={m.id} className="quick-member" onClick={() => handleQuickSelect(m.memberCode)}>
              <div className="quick-member-name">
                {maskName(m.name)} <span className="text-gray" style={{ fontWeight: 400, fontSize: 12 }}>({m.phone})</span>
              </div>
              <div className="quick-member-code">{m.memberCode}</div>
              <div className="quick-member-balance">{formatCurrency(m.balance)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
