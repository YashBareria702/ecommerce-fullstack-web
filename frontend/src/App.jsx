import { useEffect, useMemo, useState } from 'react'
import './App.css'

const initialProducts = [
  { id: 'g1', name: 'Fresh farm tomatoes', category: 'Fresh vegetables', price: 40, description: 'Ripe, juicy tomatoes for everyday cooking.', image: 'https://images.unsplash.com/photo-1546094096-0df4bcaaa337?auto=format&fit=crop&w=900&q=85', badge: 'FRESH TODAY' },
  { id: 'g2', name: 'Sweet Nagpur oranges', category: 'Fresh fruits', price: 90, description: 'A bright, sweet little boost of freshness.', image: 'https://images.unsplash.com/photo-1547514701-42782101795e?auto=format&fit=crop&w=900&q=85', badge: 'SEASONAL' },
  { id: 'g3', name: 'Whole wheat atta · 5 kg', category: 'Staples', price: 265, description: 'Everyday goodness for soft, homestyle rotis.', image: 'https://images.unsplash.com/photo-1627485937980-221c88ac04f9?auto=format&fit=crop&w=900&q=85', badge: '' },
  { id: 'g4', name: 'Farm fresh milk · 1 L', category: 'Dairy & eggs', price: 68, description: 'Fresh milk for your morning chai and more.', image: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?auto=format&fit=crop&w=900&q=85', badge: 'DAILY ESSENTIAL' },
]
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch { return fallback } }
const money = n => `₹${Number(n).toLocaleString('en-IN')}`
const loadProducts = () => {
  const saved = read('qc-products', null)
  if (!saved) return initialProducts
  const cleaned = saved.filter(product => !['p1', 'p2', 'p3', 'p4'].includes(product.id))
  return cleaned.length ? cleaned : initialProducts
}

function App() {
  const [products, setProducts] = useState(loadProducts)
  const [orders, setOrders] = useState(() => read('qc-orders', []))
  const [customer, setCustomer] = useState(() => { const saved = read('qc-customer', null); return saved?.username ? saved : null })
  const [customerToken, setCustomerToken] = useState(() => localStorage.getItem('qc-customer-token') || '')
  const [authMode, setAuthMode] = useState('login')
  const [authUsername, setAuthUsername] = useState('')
  const [authName, setAuthName] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [notice, setNotice] = useState('')
  const [cart, setCart] = useState([])
  const [tab, setTab] = useState('shop')
  const [category, setCategory] = useState('Everything')
  const [search, setSearch] = useState('')
  const [cartOpen, setCartOpen] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [ownerLoginOpen, setOwnerLoginOpen] = useState(false)
  const [ownerPassword, setOwnerPassword] = useState('')
  const [ownerError, setOwnerError] = useState('')
  const [ownerToken, setOwnerToken] = useState(() => sessionStorage.getItem('qc-owner-token') || '')
  const [productForm, setProductForm] = useState({ name: '', category: 'Fresh vegetables', price: '', description: '', image: '' })
  const [customerForm, setCustomerForm] = useState({ name: '', phone: '', address: '' })
  const [checkout, setCheckout] = useState(false)

  useEffect(() => localStorage.setItem('qc-products', JSON.stringify(products)), [products])
  useEffect(() => localStorage.setItem('qc-orders', JSON.stringify(orders)), [orders])
  useEffect(() => { if (customer) localStorage.setItem('qc-customer', JSON.stringify(customer)) }, [customer])

  const categories = ['Everything', ...new Set(products.map(p => p.category).filter(Boolean))]
  const filtered = useMemo(() => products.filter(p => (category === 'Everything' || p.category === category) && `${p.name} ${p.description}`.toLowerCase().includes(search.toLowerCase())), [products, category, search])
  const total = cart.reduce((sum, item) => sum + Number(item.price), 0)
  const flash = message => { setNotice(message); window.setTimeout(() => setNotice(''), 3600) }

  const handleAuth = async event => {
    event.preventDefault()
    try {
      const registering = authMode === 'register'
      const response = await fetch(`/api/${registering ? 'register' : 'login'}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: authUsername.trim(), name: authName.trim() || authUsername.trim(), password: authPassword }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || (registering ? 'Could not create account.' : 'Username or password is incorrect.'))
      if (registering) { setAuthMode('login'); setAuthPassword(''); flash('Account created. Now log in with your username and password.'); return }
      const signedIn = { username: data.user.username, name: data.user.name }
      setCustomer(signedIn); setCustomerToken(data.token); localStorage.setItem('qc-customer-token', data.token); setCustomerForm({ name: signedIn.name || '', phone: '', address: '' }); flash('Welcome to Quality Corner.')
    } catch (error) { flash(error.message || 'Could not reach the shop server.') }
  }
  const signOut = () => { setCustomer(null); setCustomerToken(''); setCart([]); setTab('shop'); localStorage.removeItem('qc-customer'); localStorage.removeItem('qc-customer-token') }
  const addToCart = product => { setCart(current => [...current, product]); flash(`${product.name} added to your bag.`) }
  const placeOrder = event => {
    event.preventDefault()
    if (!customerForm.name.trim() || !customerForm.phone.trim() || !customerForm.address.trim()) return
    const order = { id: `QC-${Date.now().toString().slice(-7)}`, createdAt: new Date().toISOString(), username: customer.username, phone: customerForm.phone.trim(), customerName: customerForm.name.trim(), address: customerForm.address.trim(), items: cart, total, status: 'Order received' }
    const next = [order, ...orders]
    fetch('/api/orders/notify', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` }, body: JSON.stringify({ orderId: order.id, customerName: order.customerName, customerMobile: order.phone, total: order.total }) })
      .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.message || 'SMS could not be sent.'); return data })
      .then(() => flash('Order placed! SMS sent to you and the shop owner.'))
      .catch(error => flash(`Order placed, but SMS was not sent: ${error.message}`))
    setOrders(next); setCart([]); setCustomer({ ...customer, name: customerForm.name.trim() }); setCheckout(false); setCartOpen(false); setTab('orders')
  }
  const addProduct = event => {
    event.preventDefault()
    if (!productForm.name.trim() || Number(productForm.price) <= 0) return
    setProducts(current => [{ ...productForm, id: `p${Date.now()}`, price: Number(productForm.price), badge: '' }, ...current])
    setProductForm({ name: '', category: 'Fresh vegetables', price: '', description: '', image: '' }); setEditorOpen(false); flash('Your new grocery item is now in the shop.')
  }
  const ownerLogin = async event => {
    event.preventDefault(); setOwnerError('')
    try {
      const response = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: ownerPassword }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Owner sign-in failed.')
      setOwnerToken(data.token); sessionStorage.setItem('qc-owner-token', data.token); setOwnerLoginOpen(false); setOwnerPassword(''); flash('Owner tools unlocked for this browser session.')
    } catch (error) { setOwnerError(error.message || 'Could not reach the shop server.') }
  }
  const removeProduct = id => { setProducts(items => items.filter(item => item.id !== id)); flash('Product removed from this browser’s shop.') }
  const choosePhoto = event => {
    const file = event.target.files?.[0]
    if (!file) return
    if (file.size > 2_000_000) { flash('Choose an image under 2 MB so it fits in your local shop.'); return }
    const reader = new FileReader(); reader.onload = () => setProductForm(form => ({ ...form, image: String(reader.result) })); reader.readAsDataURL(file)
  }

  if (!customer) return <main className="login-screen"><div className="login-photo" aria-hidden="true" /><section className="login-card"><a className="wordmark" href="#"><span className="brand-mark">q</span><span>quality<span className="brand-light">corner</span><small>FRESH EVERY DAY.</small></span></a><div className="login-copy"><span className="eyebrow">YOUR NEIGHBOURHOOD GROCERY, ONLINE</span><h1>{authMode === 'register' ? <>Let’s get<br /><em>you started.</em></> : <>Fresh from<br /><em>our shelves to yours.</em></>}</h1><p>Everyday groceries, fresh produce and all the little things your home needs.</p></div><form className="auth-form" onSubmit={handleAuth}>{authMode === 'register' && <><label htmlFor="auth-name">Your name</label><input id="auth-name" type="text" autoComplete="name" placeholder="Full name" value={authName} onChange={e => setAuthName(e.target.value)} required /></>}<label htmlFor="auth-username">Username</label><input id="auth-username" type="text" autoComplete="username" placeholder="Choose a username" value={authUsername} onChange={e => setAuthUsername(e.target.value)} minLength={3} maxLength={32} pattern="[A-Za-z0-9_.-]+" required /><label htmlFor="auth-password">Password</label><input id="auth-password" type="password" autoComplete={authMode === 'register' ? 'new-password' : 'current-password'} placeholder={authMode === 'register' ? 'At least 8 characters' : 'Your password'} value={authPassword} onChange={e => setAuthPassword(e.target.value)} minLength={8} required /><button className="primary-button" type="submit">{authMode === 'register' ? 'Create account' : 'Log in'} <span>→</span></button><p className="form-helper">{authMode === 'register' ? 'Create a free account to save and view your orders.' : 'Log in with your Quality Corner username and password.'}</p></form><button className="text-button auth-switch" onClick={() => { setAuthMode(authMode === 'register' ? 'login' : 'register'); setAuthPassword('') }}>{authMode === 'register' ? 'Already have an account? Log in' : 'New to Quality Corner? Create an account'}</button><div className="login-footer"><span>✳&nbsp; Fresh groceries, close to home</span><span>Your neighbourhood store</span></div></section>{notice && <div className="toast">{notice}<button onClick={() => setNotice('')}>×</button></div>}</main>

  return <div className="app-shell"><div className="announcement"><span>✳ &nbsp; Fresh picks for your everyday kitchen</span><span>Good groceries, right around the corner. &nbsp; ✳</span></div><header className="site-header"><a className="wordmark" href="#" onClick={() => setTab('shop')}><span className="brand-mark">q</span><span>quality<span className="brand-light">corner</span><small>FRESH EVERY DAY.</small></span></a><nav className="main-nav"><button className={tab === 'shop' ? 'active' : ''} onClick={() => setTab('shop')}>Groceries</button><button className={tab === 'orders' ? 'active' : ''} onClick={() => setTab('orders')}>My orders <span className="nav-count">{orders.filter(o => o.username === customer.username).length}</span></button></nav><div className="header-actions"><span className="hello-label">Hi{customer.name ? `, ${customer.name.split(' ')[0]}` : ''} <span>✳</span></span><button className="icon-button cart-trigger" onClick={() => setCartOpen(true)} aria-label="Open shopping bag"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 8h14l1 12H4L5 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/></svg><span>Basket <b>{cart.length}</b></span></button><button className="avatar-button" onClick={signOut} title="Sign out">{customer.username.slice(0, 2).toUpperCase()}</button></div></header>

  {tab === 'shop' ? <><main><section className="hero-banner"><img src="https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=2200&q=90" alt="Fresh vegetables and groceries at a neighbourhood market"/><div className="hero-overlay"/><div className="hero-content"><span className="eyebrow">FRESHNESS, JUST AROUND THE CORNER</span><h1>Good food,<br /><em>for every day.</em></h1><p>Fresh fruits, pantry favourites and everyday essentials from your neighbourhood store.</p><button className="hero-button" onClick={() => document.getElementById('collection')?.scrollIntoView({ behavior: 'smooth' })}>Shop groceries <span>↓</span></button></div><div className="hero-caption">FRESH PICKS AT QUALITY CORNER &nbsp; · &nbsp; EVERY DAY</div></section><section className="promise-row"><div><span>✳</span><p><b>Fresh picks daily</b><small>Good produce for your kitchen</small></p></div><div><span>♡</span><p><b>Everyday essentials</b><small>All your regulars in one place</small></p></div><div><span>⌂</span><p><b>Your local grocery</b><small>Here when the kitchen calls</small></p></div></section>

  <section className="collection-section" id="collection"><div className="section-heading"><div><span className="eyebrow">FRESH FROM OUR GROCERY SHELVES</span><h2>Today’s good groceries<span>.</span></h2><p>Fresh produce, pantry staples and everyday kitchen essentials.</p></div><span className="product-total">{filtered.length.toString().padStart(2, '0')} ITEMS</span></div><div className="filter-bar"><div className="category-pills">{categories.map(c => <button key={c} className={category === c ? 'selected' : ''} onClick={() => setCategory(c)}>{c}</button>)}</div><label className="search-box"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="11" cy="11" r="7"/><path d="m16 16 4 4"/></svg><input placeholder="Search groceries..." value={search} onChange={e => setSearch(e.target.value)}/><span>/</span></label></div>
  {filtered.length ? <div className="product-grid">{filtered.map((product, index) => <article className="product-card" key={product.id}><div className="product-image-wrap"><img className="product-image" src={product.image || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=900&q=85'} alt={product.name} loading={index > 3 ? 'lazy' : 'eager'}/>{product.badge && <span className="product-badge">{product.badge}</span>}<button className="quick-add" onClick={() => addToCart(product)}><span>＋</span> ADD TO BASKET</button>{ownerToken && <button className="owner-remove" onClick={() => removeProduct(product.id)} aria-label={`Remove ${product.name}`} title="Remove product">Remove ×</button>}</div><div className="product-details"><div><span className="product-category">{product.category}</span><h3>{product.name}</h3><p>{product.description}</p></div><span className="product-price">{money(product.price)}</span></div></article>)}</div> : <div className="empty-products"><span>✳</span><h3>No grocery items here just yet.</h3><p>Add your first grocery item to get your shop started.</p>{ownerToken && <button className="primary-button" onClick={() => setEditorOpen(true)}>Add a product <span>＋</span></button>}</div>}</section><section className="story-band"><div className="story-sun">✳</div><div><span className="eyebrow">A NOTE FROM YOUR LOCAL GROCERY</span><h2>Good food brings<br />a little <em>joy every day.</em></h2></div><p>From fresh fruits and vegetables to the pantry staples your family loves, Quality Corner is here to make everyday shopping easy.</p><span className="story-scribble">fresh is best ♥</span></section></main><footer className="site-footer"><a className="wordmark footer-mark" href="#" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}><span className="brand-mark">q</span><span>quality<span className="brand-light">corner</span><small>FRESH EVERY DAY.</small></span></a><span>Fresh groceries, close to home. &nbsp;✳</span>{ownerToken ? <><button onClick={() => setEditorOpen(true)}>＋ Add a grocery item</button><button onClick={() => { setOwnerToken(''); sessionStorage.removeItem('qc-owner-token') }}>Lock owner tools</button></> : <button onClick={() => setOwnerLoginOpen(true)}>Store owner? Manage products →</button>}</footer></> : <main className="orders-page"><div className="orders-heading"><span className="eyebrow">A LITTLE LOOK BACK</span><h1>Your orders<span>.</span></h1><p>Everything you’ve brought home from Quality Corner.</p></div>{orders.filter(o => o.username === customer.username).length ? <div className="orders-list">{orders.filter(o => o.username === customer.username).map(order => <article className="order-card" key={order.id}><div className="order-top"><div><span className="eyebrow">ORDER {order.id}</span><h2>{new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</h2></div><span className="order-status"><i/> {order.status}</span></div><div className="order-items">{order.items.map((item, i) => <div className="order-item" key={`${item.id}-${i}`}><img src={item.image} alt=""/><span>{item.name}</span><b>{money(item.price)}</b></div>)}</div><div className="order-bottom"><span>Delivery for {order.customerName} · {order.address}</span><b>Total &nbsp; {money(order.total)}</b></div></article>)}</div> : <div className="empty-orders"><div>♡</div><h2>No orders just yet.</h2><p>Your next favourite might be just around the corner.</p><button className="primary-button" onClick={() => setTab('shop')}>Explore the shop <span>→</span></button></div>}</main>}

  <footer className="mobile-footer"><span>✳ &nbsp; A little shop with a lot of heart</span><span>{customer.username} &nbsp;·&nbsp; <button onClick={signOut}>Sign out</button></span></footer>

  {cartOpen && <div className="drawer-backdrop" onClick={() => { setCartOpen(false); setCheckout(false) }}><aside className="cart-drawer" onClick={e => e.stopPropagation()}><div className="drawer-heading"><div><span className="eyebrow">YOUR GROCERY BASKET</span><h2>{checkout ? 'Delivery details' : 'Your basket'}<span>.</span></h2></div><button className="close-button" onClick={() => { setCartOpen(false); setCheckout(false) }}>×</button></div>{checkout ? <form className="delivery-form" onSubmit={placeOrder}><div className="delivery-intro"><span className="delivery-icon">⌂</span><p>Where should we bring your groceries?</p></div><label>Your name<input value={customerForm.name} onChange={e => setCustomerForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name" required/></label><label>Your mobile number<input type="tel" inputMode="numeric" autoComplete="tel" value={customerForm.phone} onChange={e => setCustomerForm(f => ({ ...f, phone: e.target.value }))} placeholder="Mobile number" required/></label><label>Delivery address<textarea value={customerForm.address} onChange={e => setCustomerForm(f => ({ ...f, address: e.target.value }))} placeholder="House number, street, area, city and PIN code" rows={4} required/></label><div className="phone-confirmation">✓ &nbsp; We’ll use this mobile number if we need to contact you about delivery.</div><div className="drawer-total"><span>Total</span><b>{money(total)}</b></div><button className="primary-button full-button" type="submit">Place my order <span>→</span></button></form> : <>{cart.length ? <><div className="cart-items">{cart.map((item, i) => <div className="cart-item" key={`${item.id}-${i}`}><img src={item.image} alt=""/><div><span className="product-category">{item.category}</span><h3>{item.name}</h3><b>{money(item.price)}</b></div><button className="remove-item" aria-label="Remove item" onClick={() => setCart(current => current.filter((_, index) => i !== index))}>×</button></div>)}</div><div className="drawer-bottom"><div className="drawer-total"><span>Subtotal <small>Delivery arranged with you after ordering</small></span><b>{money(total)}</b></div><button className="primary-button full-button" onClick={() => { setCustomerForm({ name: customer.name, phone: orders.find(o => o.username === customer.username)?.phone || '', address: orders.find(o => o.username === customer.username)?.address || '' }); setCheckout(true) }}>Continue to delivery <span>→</span></button><button className="continue-shopping" onClick={() => setCartOpen(false)}>Keep having a look</button></div></> : <div className="empty-bag"><span>♡</span><h3>Your basket is empty for now.</h3><p>Find your everyday groceries and add them here.</p><button className="primary-button" onClick={() => { setCartOpen(false); setTab('shop') }}>Explore the shop <span>→</span></button></div>}</>}</aside></div>}

  {ownerLoginOpen && <div className="modal-backdrop" onClick={() => setOwnerLoginOpen(false)}><section className="product-modal owner-modal" onClick={e => e.stopPropagation()}><div className="drawer-heading"><div><span className="eyebrow">JUST FOR THE SHOP OWNER</span><h2>Owner sign in<span>.</span></h2></div><button className="close-button" onClick={() => setOwnerLoginOpen(false)}>×</button></div><form className="delivery-form" onSubmit={ownerLogin}><p className="local-note">Enter the owner password you set in the server’s private <code>.env</code> file as <code>ADMIN_PASSWORD</code>.</p><label>Owner password<input type="password" autoComplete="current-password" value={ownerPassword} onChange={e => setOwnerPassword(e.target.value)} placeholder="Your private password" required/></label>{ownerError && <p className="owner-error">{ownerError}</p>}<button className="primary-button full-button" type="submit">Unlock product tools <span>→</span></button></form></section></div>}
  {editorOpen && ownerToken && <div className="modal-backdrop" onClick={() => setEditorOpen(false)}><section className="product-modal" onClick={e => e.stopPropagation()}><div className="drawer-heading"><div><span className="eyebrow">ADD A GROCERY ITEM</span><h2>Add grocery item<span>.</span></h2></div><button className="close-button" onClick={() => setEditorOpen(false)}>×</button></div><form className="delivery-form" onSubmit={addProduct}><label>Product name<input value={productForm.name} onChange={e => setProductForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Basmati rice 5 kg" required/></label><div className="form-row"><label>Price (₹)<input type="number" min="1" step="1" value={productForm.price} onChange={e => setProductForm(f => ({ ...f, price: e.target.value }))} placeholder="499" required/></label><label>Category<input value={productForm.category} onChange={e => setProductForm(f => ({ ...f, category: e.target.value }))} placeholder="Fresh vegetables" required/></label></div><label>A little description<textarea rows={2} value={productForm.description} onChange={e => setProductForm(f => ({ ...f, description: e.target.value }))} placeholder="Brand, size or details"/></label><label>Product photo<div className="upload-box"><input type="file" accept="image/*" onChange={choosePhoto}/><span>{productForm.image ? '✓ Photo is ready' : '＋ Choose a photo'}</span><small>JPG or PNG · up to 2 MB</small></div></label><button className="primary-button full-button" type="submit">Add to my grocery shop <span>→</span></button><p className="local-note">Products currently save in this browser. Server-backed product storage is a later step.</p></form></section></div>}
  {notice && <div className="toast">{notice}<button onClick={() => setNotice('')}>×</button></div>}</div>
}

export default App
