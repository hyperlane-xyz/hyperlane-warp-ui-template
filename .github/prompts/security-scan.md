## Frontend Security Focus Areas

This is a Web3 frontend application. Pay special attention to:

### XSS & Content Security
- Input sanitization before rendering user data
- Dangerous patterns: dangerouslySetInnerHTML, eval(), innerHTML
- URL validation (javascript: protocol, data: URLs)
- CSP headers and inline script risks

### Web3 Wallet Security
- Blind signature attacks (signing data without user understanding)
- Transaction simulation before signing
- Clear message display before signature requests
- Proper origin/domain verification for wallet connections
- **Chain-aware address validation** - EVM hex can lowercase; Solana base58/Cosmos bech32 are case-sensitive
- **Don't collapse addresses** - Normalizing non-EVM addresses can create security issues

### Dependency & Supply Chain
- Known vulnerabilities in dependencies
- Malicious packages, typosquatting
- Outdated critical security packages

### API & Token Security
- CORS configuration
- Token storage (avoid localStorage for sensitive tokens)
- API key exposure in client-side code

### Private Key Handling
- NEVER expose private keys client-side
- Check for hardcoded keys or mnemonics
- Wallet connection patterns should not request keys

### Content Security Policy
- New external resources (scripts, styles, frames) need CSP header updates
- Check `next.config.js` for script-src, style-src, connect-src, frame-src
- Third-party integrations (Intercom, analytics, wallets) need explicit allowlisting
- Test with CSP enabled in production mode
