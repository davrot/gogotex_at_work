import { describe, it, expect } from 'vitest'
import { getServiceOrigin, originRateKey } from '../../../../app/src/infrastructure/ServiceOrigin.mjs'

describe('ServiceOrigin helper', function () {
  it('returns X-Service-Origin header when present', function () {
    const req = { headers: { 'x-service-origin': 'bench-client-1' } }
    expect(getServiceOrigin(req)).to.equal('bench-client-1')
    expect(originRateKey(req)).to.equal('service-origin:bench-client-1')
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

  it('returns null for invalid req', function () {
    expect(getServiceOrigin(null)).to.equal(null)
  })
})