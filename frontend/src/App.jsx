import { useState, useEffect } from 'react';
import axios from 'axios';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [isLoginView, setIsLoginView] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMessage, setAuthMessage] = useState('');

  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null); 

  useEffect(() => {
    if (token) {
      axios.get('http://localhost:5000/api/products')
        .then((response) => {
          setProducts(response.data);
          setLoading(false);
        })
        .catch((error) => console.error('Error fetching products:', error));
    }
  }, [token]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000); 
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    try {
      if (isLoginView) {
        const response = await axios.post('http://localhost:5000/api/login', { email, password });
        setToken(response.data.token);
        localStorage.setItem('token', response.data.token);
        setAuthMessage('');
      } else {
        await axios.post('http://localhost:5000/api/register', { name, email, password });
        setAuthMessage('Registration successful! You can now log in.');
        setIsLoginView(true);
      }
    } catch (error) {
      setAuthMessage(error.response?.data?.message || 'Something went wrong');
    }
  };

  const logout = () => {
    setToken('');
    localStorage.removeItem('token');
    setCart([]); 
    setToast(null);
  };

  const addToCart = (product) => {
    setCart([...cart, product]);
    showToast(`${product.name} added to cart!`);
  };

  const removeFromCart = (indexToRemove) => {
    setCart(cart.filter((_, index) => index !== indexToRemove));
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    const totalAmount = cart.reduce((sum, item) => sum + Number(item.price), 0);

    try {
      await axios.post(
        'http://localhost:5000/api/checkout',
        { cartItems: cart, totalAmount: totalAmount },
        { headers: { Authorization: `Bearer ${token}` } } 
      );
      showToast('🎉 Order placed successfully! Check your database.', 'success');
      setCart([]); 
    } catch (error) {
      console.error(error);
      showToast('❌ Checkout failed. Please try again.', 'error');
    }
  };

  // ==========================================
  // CLEAN & MINIMAL CSS 
  // ==========================================
  const globalStyles = `
    body {
      background-color: #f8f9fa;
      margin: 0;
      color: #2b2b40;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes slideUp {
      from { transform: translateY(100px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    .fade-in {
      animation: fadeIn 0.6s ease-out forwards;
    }
    .dynamic-card {
      background: white;
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.03);
      transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
      border: 1px solid #f1f1f4;
    }
    .dynamic-card:hover {
      transform: translateY(-8px);
      box-shadow: 0 15px 30px rgba(0,0,0,0.08);
      border-color: #dcdde1;
    }
    .dynamic-btn {
      transition: all 0.2s ease;
    }
    .dynamic-btn:hover:not(:disabled) {
      filter: brightness(1.1);
      transform: translateY(-2px);
      box-shadow: 0 5px 15px rgba(0,0,0,0.1);
    }
    .dynamic-btn:active:not(:disabled) {
      transform: translateY(0);
    }
    .glass-cart {
      background: rgba(255, 255, 255, 0.7);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border-radius: 20px;
      box-shadow: 0 8px 32px rgba(31, 38, 135, 0.07);
      border: 1px solid rgba(255, 255, 255, 1);
    }
    .remove-btn {
      background: #ffeaa7;
      color: #d63031;
      border: none;
      border-radius: 50%;
      width: 28px;
      height: 28px;
      cursor: pointer;
      font-weight: bold;
      transition: 0.2s;
    }
    .remove-btn:hover {
      background: #ff7675;
      color: white;
      transform: rotate(90deg);
    }
    .floating-toast {
      position: fixed;
      bottom: 30px;
      right: 30px;
      padding: 16px 24px;
      border-radius: 12px;
      color: white;
      font-weight: 600;
      box-shadow: 0 10px 25px rgba(0,0,0,0.2);
      animation: slideUp 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
      z-index: 1000;
    }
  `;

  if (!token) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: "'Inter', sans-serif" }}>
        <style>{globalStyles}</style>
        <div className="dynamic-card" style={{ width: '100%', maxWidth: '420px', textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '40px', marginBottom: '10px' }}>🔐</div>
          <h2 style={{ color: '#2d3436', margin: '0 0 25px 0' }}>{isLoginView ? 'Welcome Back' : 'Create Account'}</h2>
          
          {authMessage && (
            <div style={{ padding: '10px', borderRadius: '8px', marginBottom: '20px', backgroundColor: isLoginView ? '#fab1a0' : '#55efc4', color: isLoginView ? '#d63031' : '#00b894', fontWeight: 'bold' }}>
              {authMessage}
            </div>
          )}
          
          <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {!isLoginView && <input type="text" placeholder="Full Name" value={name} onChange={(e) => setName(e.target.value)} required style={{ padding: '14px', borderRadius: '10px', border: '1px solid #dfe6e9', outline: 'none', fontSize: '15px' }} />}
            <input type="email" placeholder="Email Address" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ padding: '14px', borderRadius: '10px', border: '1px solid #dfe6e9', outline: 'none', fontSize: '15px' }} />
            <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ padding: '14px', borderRadius: '10px', border: '1px solid #dfe6e9', outline: 'none', fontSize: '15px' }} />
            
            <button className="dynamic-btn" type="submit" style={{ padding: '14px', backgroundColor: '#0984e3', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold', marginTop: '10px' }}>
              {isLoginView ? 'Sign In' : 'Register'}
            </button>
          </form>

          <button onClick={() => setIsLoginView(!isLoginView)} style={{ marginTop: '25px', background: 'none', border: 'none', color: '#636e72', cursor: 'pointer', fontWeight: '500', transition: '0.2s' }}>
            {isLoginView ? "Don't have an account? Create one" : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '30px', fontFamily: "'Inter', sans-serif", maxWidth: '1300px', margin: '0 auto' }}>
      <style>{globalStyles}</style>
      
      <div className="fade-in" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px', background: 'white', padding: '15px 30px', borderRadius: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
        <h1 style={{ margin: 0, color: '#2d3436', fontSize: '26px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '32px' }}>⚡</span> ProStore
        </h1>
        <button className="dynamic-btn" onClick={logout} style={{ padding: '10px 24px', backgroundColor: '#ff7675', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' }}>
          Logout
        </button>
      </div>

      <div style={{ display: 'flex', gap: '40px', alignItems: 'flex-start' }}>
        
        <div style={{ flex: 2 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '2px solid #f1f2f6', paddingBottom: '15px' }}>
            <h2 style={{ color: '#2d3436', margin: 0 }}>Trending Now</h2>
            <span style={{ color: '#b2bec3', fontWeight: '600' }}>{products.length} Items</span>
          </div>
          
          {loading ? (
            <div style={{ textAlign: 'center', padding: '50px', color: '#636e72', fontSize: '18px' }}>
              <div style={{ animation: 'spin 1s linear infinite', fontSize: '30px', display: 'inline-block' }}>⏳</div>
              <p>Loading the latest gear...</p>
            </div>
          ) : (
            <div className="fade-in" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '25px', marginTop: '25px' }}>
              {products.map((product) => (
                <div key={product.id} className="dynamic-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <h3 style={{ margin: '0 0 8px 0', color: '#2d3436', fontSize: '20px' }}>{product.name}</h3>
                    <p style={{ color: '#636e72', fontSize: '14px', lineHeight: '1.6' }}>{product.description}</p>
                  </div>
                  <div style={{ marginTop: '25px' }}>
                    <h2 style={{ color: '#00b894', margin: '0 0 15px 0', fontSize: '26px' }}>₹{product.price}</h2>
                    <button 
                      className="dynamic-btn"
                      onClick={() => addToCart(product)} 
                      style={{ padding: '14px', backgroundColor: '#0984e3', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', width: '100%', fontWeight: 'bold', fontSize: '15px' }}>
                      + Add to Cart
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass-cart fade-in" style={{ flex: 1, padding: '30px', position: 'sticky', top: '30px', minWidth: '320px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid rgba(0,0,0,0.05)', paddingBottom: '15px', marginBottom: '20px' }}>
            <h2 style={{ color: '#2d3436', margin: 0 }}>Your Cart</h2>
            <div style={{ background: '#0984e3', color: 'white', padding: '4px 12px', borderRadius: '20px', fontWeight: 'bold', fontSize: '14px' }}>
              {cart.length} {cart.length === 1 ? 'Item' : 'Items'}
            </div>
          </div>
          
          {cart.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px 0', color: '#b2bec3' }}>
              <div style={{ fontSize: '50px', marginBottom: '15px', opacity: 0.5 }}>🛒</div>
              <p style={{ margin: 0, fontWeight: '500' }}>Your cart is empty.</p>
              <p style={{ fontSize: '13px', marginTop: '5px' }}>Add some products to get started.</p>
            </div>
          ) : (
            <div style={{ maxHeight: '400px', overflowY: 'auto', paddingRight: '10px' }}>
              <ul style={{ paddingLeft: 0, listStyle: 'none', margin: 0 }}>
                {cart.map((item, index) => (
                  <li key={index} className="fade-in" style={{ padding: '15px 0', borderBottom: '1px dashed #dfe6e9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#2d3436' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: '600' }}>{item.name}</span>
                      <span style={{ color: '#00b894', fontWeight: 'bold', fontSize: '14px' }}>₹{item.price}</span>
                    </div>
                    <button className="remove-btn" onClick={() => removeFromCart(index)} title="Remove item">
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ marginTop: '30px', background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 10px rgba(0,0,0,0.02)' }}>
            <h3 style={{ display: 'flex', justifyContent: 'space-between', color: '#2d3436', margin: '0 0 20px 0', fontSize: '22px' }}>
              <span>Total:</span> 
              <span style={{ color: '#00b894' }}>₹{cart.reduce((sum, item) => sum + Number(item.price), 0).toFixed(2)}</span>
            </h3>
            
            <button 
              className="dynamic-btn"
              onClick={handleCheckout} 
              disabled={cart.length === 0}
              style={{ padding: '16px', backgroundColor: cart.length > 0 ? '#6c5ce7' : '#dfe6e9', color: cart.length > 0 ? 'white' : '#b2bec3', border: 'none', borderRadius: '10px', cursor: cart.length > 0 ? 'pointer' : 'not-allowed', width: '100%', fontSize: '16px', fontWeight: 'bold' }}>
              {cart.length > 0 ? 'Secure Checkout 🚀' : 'Waiting for items...'}
            </button>
          </div>
        </div>

      </div>

      {toast && (
        <div className="floating-toast" style={{ backgroundColor: toast.type === 'success' ? '#00b894' : '#d63031' }}>
          {toast.message}
        </div>
      )}
    </div>
  );
}

export default App;