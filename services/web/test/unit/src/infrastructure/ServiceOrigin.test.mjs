import { describe, it, expect } from 'vitest'
import { getServiceOrigin, originRateKey } from '../../../../app/src/infrastructure/ServiceOrigin.mjs'

describe('ServiceOrigin helper', function () {
  it('returns X-Service-Origin header when present and trusted', function () {
    process.env.TRUST_X_SERVICE_ORIGIN = 'true'
    process.env.TRUSTED_PROXIES = ''
    const req = { headers: { 'x-service-origin': 'bench-client-1' } }
    expect(getServiceOrigin(req)).to.equal('bench-client-1')
    expect(originRateKey(req)).to.equal('service-origin:bench-client-1')
    delete process.env.TRUST_X_SERVICE_ORIGIN
    delete process.env.TRUSTED_PROXIES
  })

  it('ignores X-Service-Origin header when not configured as trusted', function () {
    delete process.env.TRUST_X_SERVICE_ORIGIN
    delete process.env.TRUSTED_PROXIES
    const req = { headers: { 'x-service-origin': 'untrusted-header' }, ip: '9.9.9.9' }
    // header should be ignored unless TRUST_X_SERVICE_ORIGIN is explicitly 'true'
    expect(getServiceOrigin(req)).to.equal('ip:9.9.9.9')
    expect(originRateKey(req)).to.equal('service-origin:ip:9.9.9.9')
  })

  it('falls back to socket certificate CN when header absent', function () {
    const req = { headers: {}, socket: { getPeerCertificate: () => ({ subject: { CN: 'client-cn' } }) } }
    expect(getServiceOrigin(req)).to.equal('client-cn')
    expect(originRateKey(req)).to.equal('service-origin:client-cn')
  })

  it('falls back to ip when header and cert absent', function () {
    const req = { headers: {}, ip: '1.2.3.4', connection: { remoteAddress: '1.2.3.4' } }
    expect(getServiceOrigin(req)).to.equal('ip:1.2.3.4')
    expect(originRateKey(req)).to.equal('service-origin:ip:1.2.3.4')
  })

  it('header overrides mTLS certificate CN when both present and trusted', function () {
    process.env.TRUST_X_SERVICE_ORIGIN = 'true'
    process.env.TRUSTED_PROXIES = ''
    const req = { headers: { 'x-service-origin': 'header-origin' }, socket: { getPeerCertificate: () => ({ subject: { CN: 'cert-cn' } }) } }
    expect(getServiceOrigin(req)).to.equal('header-origin')
    expect(originRateKey(req)).to.equal('service-origin:header-origin')
    delete process.env.TRUST_X_SERVICE_ORIGIN
    delete process.env.TRUSTED_PROXIES
  })

  it('header overrides ip when both present and trusted', function () {
    process.env.TRUST_X_SERVICE_ORIGIN = 'true'
    process.env.TRUSTED_PROXIES = '1.2.3.4'
    const req = { headers: { 'x-service-origin': 'header-origin' }, ip: '1.2.3.4', connection: { remoteAddress: '1.2.3.4' } }
    expect(getServiceOrigin(req)).to.equal('header-origin')
    expect(originRateKey(req)).to.equal('service-origin:header-origin')
    delete process.env.TRUST_X_SERVICE_ORIGIN
    delete process.env.TRUSTED_PROXIES
  })

  it('returns null for invalid req', function () {
    expect(getServiceOrigin(null)).to.equal(null)
  })
})