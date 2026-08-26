'use client';

import React, { useState, useEffect } from 'react';
import { Package, Plus, ShoppingCart, Trash2, Edit2, X, Check, AlertTriangle, TrendingUp, Search, ChevronDown } from 'lucide-react';
import { getProducts, addProduct, updateProduct, deleteProduct, recordProductSale, getProductSales, getCustomers } from '@/lib/actions';

const CATEGORIES = ['Supplement', 'Accessory', 'Drink', 'Snack', 'Apparel', 'Equipment', 'Other'];
const UNITS = ['unit', 'kg', 'litre', 'pack', 'bottle', 'scoop'];

type CartItem = {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  stock: number;
};

export default function ProductsPage() {
  const [gymId, setGymId] = useState('gym_1');
  const [activeTab, setActiveTab] = useState<'catalog' | 'pos' | 'sales'>('catalog');
  const [products, setProducts] = useState<any[]>([]);
  const [productSales, setProductSales] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');

  // Add/Edit Product Modal
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [pName, setPName] = useState('');
  const [pCategory, setPCategory] = useState('Supplement');
  const [pPrice, setPPrice] = useState(0);
  const [pStock, setPStock] = useState(0);
  const [pUnit, setPUnit] = useState('unit');
  const [savingProduct, setSavingProduct] = useState(false);

  // POS Cart
  const [cart, setCart] = useState<CartItem[]>([]);
  const [posPaymentMethod, setPosPaymentMethod] = useState<'CASH' | 'UPI' | 'CARD' | 'SPLIT'>('CASH');
  const [posCashSplit, setPosCashSplit] = useState(0);
  const [posUpiSplit, setPosUpiSplit] = useState(0);
  const [posCustomer, setPosCustomer] = useState<string | null>(null);
  const [posCustomerName, setPosCustomerName] = useState('');
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [lastSaleMsg, setLastSaleMsg] = useState<string | null>(null);

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const id = typeof window !== 'undefined' ? localStorage.getItem('active_gym_id') || 'gym_1' : 'gym_1';
    setGymId(id);
    loadAll(id);
  }, []);

  const loadAll = async (id: string) => {
    const [prods, sales, custs] = await Promise.all([
      getProducts(id),
      getProductSales(id),
      getCustomers(id)
    ]);
    setProducts(prods);
    setProductSales(sales);
    setCustomers(custs);
  };

  const openAddModal = () => {
    setEditingProduct(null);
    setPName(''); setPCategory('Supplement'); setPPrice(0); setPStock(0); setPUnit('unit');
    setShowProductModal(true);
  };

  const openEditModal = (p: any) => {
    setEditingProduct(p);
    setPName(p.name); setPCategory(p.category); setPPrice(p.price); setPStock(p.stock); setPUnit(p.unit);
    setShowProductModal(true);
  };

  const handleSaveProduct = async () => {
    if (!pName.trim() || pPrice <= 0) return;
    setSavingProduct(true);
    try {
      if (editingProduct) {
        await updateProduct(editingProduct.id, { name: pName, category: pCategory, price: pPrice, stock: pStock, unit: pUnit });
      } else {
        await addProduct({ gymId, name: pName, category: pCategory, price: pPrice, stock: pStock, unit: pUnit });
      }
      await loadAll(gymId);
      setShowProductModal(false);
    } finally { setSavingProduct(false); }
  };

  const handleDeleteProduct = async (id: string) => {
    await deleteProduct(id);
    setDeleteId(null);
    await loadAll(gymId);
  };

  // POS Cart Actions
  const addToCart = (product: any) => {
    if (product.stock <= 0) return;
    setCart(prev => {
      const existing = prev.find(i => i.productId === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) return prev;
        return prev.map(i => i.productId === product.id ? { ...i, quantity: i.quantity + 1, totalPrice: (i.quantity + 1) * i.unitPrice } : i);
      }
      return [...prev, { productId: product.id, productName: product.name, quantity: 1, unitPrice: product.price, totalPrice: product.price, stock: product.stock }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(i => i.productId !== productId));
  };

  const updateQty = (productId: string, qty: number) => {
    if (qty <= 0) { removeFromCart(productId); return; }
    setCart(prev => prev.map(i => i.productId === productId ? { ...i, quantity: qty, totalPrice: qty * i.unitPrice } : i));
  };

  const cartTotal = cart.reduce((s, i) => s + i.totalPrice, 0);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setCheckoutLoading(true);
    try {
      const selectedCust = customers.find((c: any) => c.id === posCustomer);
      const splitDetails = posPaymentMethod === 'SPLIT' ? { cash: posCashSplit, upi: posUpiSplit } : null;
      await recordProductSale({
        gymId,
        items: cart,
        totalAmount: cartTotal,
        paymentMethod: posPaymentMethod,
        splitDetails,
        customerId: selectedCust?.id || null,
        customerName: selectedCust?.name || posCustomerName || null
      });
      setLastSaleMsg(`✅ Sale of ₹${cartTotal.toLocaleString('en-IN')} recorded! Revenue ledger updated.`);
      setCart([]);
      setPosCustomer(null);
      setPosCustomerName('');
      await loadAll(gymId);
      setTimeout(() => setLastSaleMsg(null), 5000);
    } finally { setCheckoutLoading(false); }
  };

  const filteredProducts = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCat = categoryFilter === 'All' || p.category === categoryFilter;
    return matchSearch && matchCat;
  });

  const todaySales = productSales.filter(s => s.date === new Date().toISOString().split('T')[0]);
  const todayRevenue = todaySales.reduce((s: number, sale: any) => s + sale.totalAmount, 0);

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold mb-2">
            <Package className="w-3.5 h-3.5" /><span>Store & POS</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Product Store</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage inventory & process sales. All sales auto-added to Revenue Hub.</p>
        </div>
        <div className="flex gap-3">
          <div className="text-right bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5">
            <p className="text-xs text-emerald-600 font-semibold">Today's Sales</p>
            <p className="text-xl font-black text-emerald-700">₹{todayRevenue.toLocaleString('en-IN')}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-100">
          {[
            { key: 'catalog', label: '📦 Product Catalog', count: products.length },
            { key: 'pos', label: '🛒 Point of Sale', count: cart.length > 0 ? cart.length : undefined },
            { key: 'sales', label: '📊 Sales History', count: productSales.length },
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors ${activeTab === tab.key ? 'border-slate-900 text-slate-900 bg-slate-50' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              {tab.label}
              {tab.count !== undefined && <span className="bg-slate-200 text-slate-700 text-xs font-bold px-1.5 py-0.5 rounded-full">{tab.count}</span>}
            </button>
          ))}
        </div>

        <div className="p-5">
          {/* ── CATALOG TAB ── */}
          {activeTab === 'catalog' && (
            <div>
              <div className="flex flex-col sm:flex-row gap-3 mb-5">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search products..." className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-800 outline-none" />
                </div>
                <div className="flex gap-2 flex-wrap">
                  {['All', ...CATEGORIES].map(cat => (
                    <button key={cat} onClick={() => setCategoryFilter(cat)} className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors ${categoryFilter === cat ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{cat}</button>
                  ))}
                </div>
                <button onClick={openAddModal} className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-lg whitespace-nowrap">
                  <Plus className="w-4 h-4" /> Add Product
                </button>
              </div>

              {filteredProducts.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Package className="w-12 h-12 mx-auto mb-3 opacity-40" />
                  <p className="font-semibold">No products found</p>
                  <p className="text-sm mt-1">Add your first product to start selling</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredProducts.map(p => (
                    <div key={p.id} className={`border rounded-xl p-4 transition-all ${p.stock === 0 ? 'border-rose-200 bg-rose-50/30' : 'border-slate-200 bg-white hover:border-slate-400'}`}>
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-bold text-slate-900 text-sm">{p.name}</p>
                          <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{p.category}</span>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => openEditModal(p)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500"><Edit2 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => setDeleteId(p.id)} className="p-1.5 hover:bg-rose-50 rounded-lg text-rose-500"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-3">
                        <p className="text-lg font-black text-slate-900">₹{p.price.toLocaleString('en-IN')}<span className="text-xs text-slate-500 font-normal ml-1">/{p.unit}</span></p>
                        <div className={`text-xs font-bold px-2.5 py-1 rounded-full ${p.stock === 0 ? 'bg-rose-100 text-rose-600' : p.stock <= 3 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {p.stock === 0 ? 'Out of Stock' : `${p.stock} in stock`}
                        </div>
                      </div>
                      <button onClick={() => { addToCart(p); setActiveTab('pos'); }} disabled={p.stock === 0}
                        className={`w-full mt-3 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors ${p.stock === 0 ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-900 hover:bg-slate-700 text-white'}`}
                      >
                        <ShoppingCart className="w-3.5 h-3.5" /> Add to Cart
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── POS TAB ── */}
          {activeTab === 'pos' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Product Quick-Add Grid */}
              <div className="lg:col-span-2 space-y-3">
                <p className="text-sm font-bold text-slate-700">Click products to add to cart:</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {products.filter(p => p.active && p.stock > 0).map(p => (
                    <button key={p.id} onClick={() => addToCart(p)}
                      className="border border-slate-200 hover:border-slate-900 hover:shadow-sm bg-white rounded-xl p-3 text-left transition-all group"
                    >
                      <p className="text-sm font-bold text-slate-900 group-hover:text-slate-700">{p.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{p.category}</p>
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-base font-black text-emerald-700">₹{p.price.toLocaleString('en-IN')}</p>
                        <span className="text-xs text-slate-400">{p.stock} left</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Cart */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2"><ShoppingCart className="w-4 h-4" /> Cart</h3>
                  {cart.length > 0 && <button onClick={() => setCart([])} className="text-xs text-rose-600 hover:underline font-semibold">Clear All</button>}
                </div>

                {lastSaleMsg && (
                  <div className="mb-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-sm font-semibold">{lastSaleMsg}</div>
                )}

                {cart.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-slate-400 text-sm py-8 text-center">
                    <div><ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-40" /><p>Cart is empty</p><p className="text-xs mt-1">Click products to add</p></div>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2 flex-1 overflow-auto max-h-56">
                      {cart.map(item => (
                        <div key={item.productId} className="flex items-center gap-2 bg-white rounded-lg p-2 border border-slate-100">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-slate-800 truncate">{item.productName}</p>
                            <p className="text-xs text-slate-500">₹{item.unitPrice} each</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <button onClick={() => updateQty(item.productId, item.quantity - 1)} className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold flex items-center justify-center">-</button>
                            <span className="w-6 text-center text-xs font-bold text-slate-800">{item.quantity}</span>
                            <button onClick={() => updateQty(item.productId, item.quantity + 1)} disabled={item.quantity >= item.stock} className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold flex items-center justify-center disabled:opacity-50">+</button>
                          </div>
                          <p className="text-xs font-black text-slate-900 w-16 text-right">₹{item.totalPrice.toLocaleString('en-IN')}</p>
                          <button onClick={() => removeFromCart(item.productId)} className="text-rose-400 hover:text-rose-600"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      ))}
                    </div>

                    <div className="border-t border-slate-200 mt-3 pt-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-700">Total</span>
                        <span className="text-xl font-black text-slate-900">₹{cartTotal.toLocaleString('en-IN')}</span>
                      </div>

                      {/* Link to customer (optional) */}
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Customer (optional)</label>
                        <select value={posCustomer || ''} onChange={e => { setPosCustomer(e.target.value || null); const c = customers.find((cu: any) => cu.id === e.target.value); setPosCustomerName(c?.name || ''); }}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:ring-2 focus:ring-slate-800 outline-none">
                          <option value="">Walk-in / Anonymous</option>
                          {customers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>

                      {/* Payment Mode */}
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5">Payment Mode</label>
                        <div className="grid grid-cols-4 gap-1">
                          {(['CASH', 'UPI', 'CARD', 'SPLIT'] as const).map(m => (
                            <button key={m} onClick={() => setPosPaymentMethod(m)} className={`py-1.5 text-xs font-bold rounded-lg border transition-colors ${posPaymentMethod === m ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-400'}`}>{m === 'SPLIT' ? '🔀' : m === 'CASH' ? '💵' : m === 'UPI' ? '📱' : '💳'}{' '}{m === 'SPLIT' ? 'Split' : m}</button>
                          ))}
                        </div>
                        {posPaymentMethod === 'SPLIT' && (
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            <div><label className="text-xs text-slate-500 font-semibold">Cash (₹)</label><input type="number" value={posCashSplit} onChange={e => setPosCashSplit(Number(e.target.value))} className="w-full px-2 py-1.5 mt-1 bg-white border border-slate-200 rounded text-xs" /></div>
                            <div><label className="text-xs text-slate-500 font-semibold">UPI (₹)</label><input type="number" value={posUpiSplit} onChange={e => setPosUpiSplit(Number(e.target.value))} className="w-full px-2 py-1.5 mt-1 bg-white border border-slate-200 rounded text-xs" /></div>
                          </div>
                        )}
                      </div>

                      <button onClick={handleCheckout} disabled={checkoutLoading || cart.length === 0}
                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 transition-colors">
                        {checkoutLoading ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Processing...</> : <><Check className="w-4 h-4" /> Complete Sale · ₹{cartTotal.toLocaleString('en-IN')}</>}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ── SALES HISTORY TAB ── */}
          {activeTab === 'sales' && (
            <div>
              {productSales.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-40" />
                  <p className="font-semibold">No sales yet</p>
                  <p className="text-sm mt-1">Complete a sale from the POS tab to see it here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {productSales.map((sale: any) => (
                    <div key={sale.id} className="border border-slate-200 rounded-xl p-4 bg-white">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-sm font-bold text-slate-800">{sale.customerName || 'Walk-in Customer'}</p>
                          <p className="text-xs text-slate-500">{sale.date} · {sale.paymentMethod}</p>
                        </div>
                        <p className="text-lg font-black text-emerald-700">₹{sale.totalAmount.toLocaleString('en-IN')}</p>
                      </div>
                      {sale.items && sale.items.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {sale.items.map((item: any, idx: number) => (
                            <span key={idx} className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-medium">
                              {item.productName} × {item.quantity}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Product Modal */}
      {showProductModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-black text-slate-900">{editingProduct ? 'Edit Product' : 'Add New Product'}</h3>
              <button onClick={() => setShowProductModal(false)} className="p-2 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Product Name *</label>
                <input value={pName} onChange={e => setPName(e.target.value)} placeholder="e.g. Whey Protein 1kg" className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-800 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Category</label>
                  <select value={pCategory} onChange={e => setPCategory(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-800 outline-none">
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Unit</label>
                  <select value={pUnit} onChange={e => setPUnit(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-800 outline-none">
                    {UNITS.map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Price (₹) *</label>
                  <input type="number" value={pPrice} onChange={e => setPPrice(Number(e.target.value))} min={0} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-800 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Stock Quantity</label>
                  <input type="number" value={pStock} onChange={e => setPStock(Number(e.target.value))} min={0} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-800 outline-none" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowProductModal(false)} className="flex-1 py-2.5 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={handleSaveProduct} disabled={!pName.trim() || pPrice <= 0 || savingProduct} className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-lg disabled:opacity-50 flex items-center justify-center gap-2">
                {savingProduct ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
                {editingProduct ? 'Save Changes' : 'Add Product'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-3"><AlertTriangle className="w-6 h-6 text-rose-600" /></div>
            <h3 className="text-lg font-black text-slate-900 mb-1">Delete Product?</h3>
            <p className="text-sm text-slate-500 mb-5">This action cannot be undone. Sales history will be preserved.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 border border-slate-200 rounded-lg text-sm font-semibold">Cancel</button>
              <button onClick={() => handleDeleteProduct(deleteId)} className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold rounded-lg">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
