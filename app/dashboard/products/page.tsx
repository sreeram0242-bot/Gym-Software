'use client';

import React, { useState, useEffect } from 'react';
import { Package, Plus, ShoppingCart, Trash2, Edit2, X, Check, AlertTriangle, TrendingUp, Search, Banknote, Smartphone, CreditCard, ArrowLeftRight, Phone, FileText, FileSpreadsheet } from 'lucide-react';
import { getProducts, addProduct, updateProduct, deleteProduct, recordProductSale, getProductSales, getCustomers, getGymSettings, getGyms } from '@/lib/actions';
import { formatDateDDMMYYYY, getLocalTodayDateString, exportToCSV } from '@/lib/utils';
import { getTemplate, compileTemplate } from '@/lib/templates';
import { exportToPDF } from '@/lib/exportPdf';

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
  const [gymName, setGymName] = useState('Our Gym');
  const [activeTab, setActiveTab] = useState<'catalog' | 'pos' | 'sales'>('pos');
  const [products, setProducts] = useState<any[]>([]);
  const [productSales, setProductSales] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [gymSettings, setGymSettings] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');

  // Add/Edit Product Modal
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [pName, setPName] = useState('');
  const [pCategory, setPCategory] = useState('Supplement');
  const [pPrice, setPPrice] = useState<number | string>(0);
  const [pStock, setPStock] = useState<number | string>(0);
  const [pUnit, setPUnit] = useState('unit');
  const [savingProduct, setSavingProduct] = useState(false);

  // POS Cart
  const [cart, setCart] = useState<CartItem[]>([]);
  const [posPaymentMethod, setPosPaymentMethod] = useState<'CASH' | 'UPI' | 'CARD' | 'SPLIT'>('CASH');
  const [posCashSplit, setPosCashSplit] = useState<number | string>(0);
  const [posUpiSplit, setPosUpiSplit] = useState<number | string>(0);
  const [posCustomer, setPosCustomer] = useState<string | null>(null);
  const [posCustomerName, setPosCustomerName] = useState('');
  const [posCustomerSearch, setPosCustomerSearch] = useState('');
  const [showPosCustomerDropdown, setShowPosCustomerDropdown] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [lastSaleMsg, setLastSaleMsg] = useState<string | null>(null);
  const [posErrorMsg, setPosErrorMsg] = useState<string | null>(null);

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const id = typeof window !== 'undefined' ? localStorage.getItem('active_gym_id') || 'gym_1' : 'gym_1';
    setGymId(id);
    loadAll(id);

    const interval = setInterval(() => {
      if (document.hidden) return;
      const currentId = typeof window !== 'undefined' ? localStorage.getItem('active_gym_id') || 'gym_1' : 'gym_1';
      loadAll(currentId);
    }, 3000);

    const handleFocus = () => {
      const currentId = typeof window !== 'undefined' ? localStorage.getItem('active_gym_id') || 'gym_1' : 'gym_1';
      loadAll(currentId);
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, []);

  const loadAll = async (id: string) => {
    const [prods, sales, custs, settings, loadedGyms] = await Promise.all([
      getProducts(id),
      getProductSales(id),
      getCustomers(id),
      getGymSettings(id),
      getGyms()
    ]);
    setProducts(prods);
    setProductSales(sales);
    setCustomers(custs);
    setGymSettings(settings);
    const matched = loadedGyms?.find((g: any) => g.id === id);
    if (matched) setGymName(matched.name);
  };

  // ─── DUAL EXPORT HANDLERS (CSV & PDF) ───
  const exportSalesCSV = () => {
    const exportData = productSales.map(s => ({
      Date: formatDateDDMMYYYY(s.date),
      Customer: s.customerName || 'Walk-in Customer',
      Payment_Method: s.paymentMethod,
      Items: (s.items || []).map((i: any) => `${i.productName} (x${i.quantity})`).join(', '),
      Total_Amount: s.totalAmount
    }));
    exportToCSV(exportData, `Product_Sales_${getLocalTodayDateString()}.csv`);
  };

  const exportSalesPDF = () => {
    const head = [['Date', 'Customer', 'Items Purchased', 'Payment Mode', 'Total Amount']];
    const body = productSales.map(s => [
      formatDateDDMMYYYY(s.date),
      s.customerName || 'Walk-in',
      (s.items || []).map((i: any) => `${i.productName} × ${i.quantity}`).join(', '),
      s.paymentMethod,
      `Rs ${s.totalAmount.toLocaleString('en-IN')}`
    ]);

    const totalRevenue = productSales.reduce((acc, s) => acc + (s.totalAmount || 0), 0);

    exportToPDF({
      gymName,
      title: 'Store & POS Sales History Report',
      subtitle: `Total Orders: ${productSales.length} | Total Revenue: Rs ${totalRevenue.toLocaleString('en-IN')}`,
      filename: `Store_Sales_${getLocalTodayDateString()}.pdf`,
      head,
      body,
      orientation: 'portrait',
      summaryBoxes: [
        { label: 'Total Orders', value: String(productSales.length) },
        { label: 'Total Revenue', value: `Rs ${totalRevenue.toLocaleString('en-IN')}` }
      ]
    });
  };

  const openAddModal = () => {
    setEditingProduct(null);
    setPName(''); setPCategory('Supplement'); setPPrice(''); setPStock(''); setPUnit('unit');
    setShowProductModal(true);
  };

  const openEditModal = (p: any) => {
    setEditingProduct(p);
    setPName(p.name); setPCategory(p.category); setPPrice(p.price); setPStock(p.stock); setPUnit(p.unit);
    setShowProductModal(true);
  };

  const handleSaveProduct = async () => {
    const numPrice = Number(pPrice);
    const numStock = Number(pStock);
    if (!pName.trim() || numPrice <= 0) return;
    setSavingProduct(true);
    try {
      if (editingProduct) {
        await updateProduct(editingProduct.id, { name: pName, category: pCategory, price: numPrice, stock: numStock, unit: pUnit });
      } else {
        await addProduct({ gymId, name: pName, category: pCategory, price: numPrice, stock: numStock, unit: pUnit });
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
    setPosErrorMsg(null);
    try {
      const selectedCust = customers.find((c: any) => c.id === posCustomer);
      const splitDetails = posPaymentMethod === 'SPLIT' ? { cash: Number(posCashSplit) || 0, upi: Number(posUpiSplit) || 0 } : null;

      if (posPaymentMethod === 'SPLIT') {
        const splitSum = (splitDetails?.cash || 0) + (splitDetails?.upi || 0);
        if (splitSum !== cartTotal) {
          setPosErrorMsg(`Split amounts (Cash: ₹${splitDetails?.cash || 0}, UPI: ₹${splitDetails?.upi || 0}) must equal Cart Total (₹${cartTotal}).`);
          setCheckoutLoading(false);
          return;
        }
      }
      await recordProductSale({
        gymId,
        items: cart,
        totalAmount: cartTotal,
        paymentMethod: posPaymentMethod,
        splitDetails,
        customerId: selectedCust?.id || null,
        customerName: selectedCust?.name || posCustomerName || null
      });

      // Send WhatsApp receipt if customer has active WhatsApp services
      let waReceiptSent = false;
      if (selectedCust && selectedCust.phone && (selectedCust.waActive || gymSettings?.waAutoMessages !== false)) {
        try {
          const rawTemplate = getTemplate(gymSettings, 'storeReceipt');
          const itemsList = cart.map(i => `• ${i.productName} (x${i.quantity}) - ₹${i.totalPrice}`).join('\n');
          const paymentModeText = posPaymentMethod === 'SPLIT' 
            ? `Split (Cash: ₹${posCashSplit || 0}, UPI: ₹${posUpiSplit || 0})`
            : posPaymentMethod;
          
          const message = compileTemplate(rawTemplate, {
            name: selectedCust.name,
            gymName: gymSettings?.gymName || 'Our Gym',
            itemsList,
            totalAmount: cartTotal.toString(),
            paymentMode: paymentModeText,
            date: formatDateDDMMYYYY(new Date())
          });

          fetch('/api/whatsapp/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              gymId,
              phone: selectedCust.phone,
              message
            })
          }).catch(err => console.error('Failed to send store WhatsApp receipt:', err));
          waReceiptSent = true;
        } catch (e) {
          console.error('Error preparing store WhatsApp receipt:', e);
        }
      }

      setLastSaleMsg(`Sale of ₹${cartTotal.toLocaleString('en-IN')} recorded! ${waReceiptSent ? `🧾 WhatsApp receipt sent to ${selectedCust?.name}.` : ''}`);
      setCart([]);
      setPosCustomer(null);
      setPosCustomerName('');
      setPosCustomerSearch('');
      await loadAll(gymId);
      setTimeout(() => setLastSaleMsg(null), 5000);
    } finally { setCheckoutLoading(false); }
  };

  const filteredProducts = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCat = categoryFilter === 'All' || p.category === categoryFilter;
    return matchSearch && matchCat;
  });

  const todaySales = productSales.filter(s => s.date === getLocalTodayDateString());
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

      {/* Tabs - Compact & Mobile Friendly */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-200 overflow-x-auto no-scrollbar bg-slate-50/70 p-1 sm:p-1.5 gap-1 sm:gap-1.5">
          {[
            { key: 'pos', icon: <ShoppingCart className="w-3.5 h-3.5 sm:w-4 sm:h-4" />, label: 'Point of Sale', count: cart.length > 0 ? cart.length : undefined },
            { key: 'catalog', icon: <Package className="w-3.5 h-3.5 sm:w-4 sm:h-4" />, label: 'Product Catalog', count: products.length },
            { key: 'sales', icon: <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />, label: 'Sales History', count: productSales.length },
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-bold whitespace-nowrap rounded-xl transition-all shrink-0 ${activeTab === tab.key ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80' : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'}`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.count !== undefined && <span className="bg-slate-100 text-slate-700 text-[9.5px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-slate-200/60">{tab.count}</span>}
            </button>
          ))}
        </div>

        <div className="p-4 sm:p-5">
          {/* ── CATALOG TAB ── */}
          {activeTab === 'catalog' && (
            <div>
              <div className="flex flex-col sm:flex-row gap-2.5 mb-4">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search products..." className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-slate-800 outline-none" />
                </div>
                <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                  {['All', ...CATEGORIES].map(cat => (
                    <button key={cat} onClick={() => setCategoryFilter(cat)} className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-colors ${categoryFilter === cat ? 'bg-slate-900 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{cat}</button>
                  ))}
                </div>
                <button onClick={openAddModal} className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl whitespace-nowrap shadow-xs">
                  <Plus className="w-3.5 h-3.5" /> Add Product
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
                  {filteredProducts.map(p => {
                    const inCart = cart.find(c => c.productId === p.id)?.quantity || 0;
                    const availableStock = p.stock - inCart;
                    return (
                    <div key={p.id} className={`border rounded-xl p-4 transition-all ${availableStock <= 0 ? 'border-rose-200 bg-rose-50/30' : 'border-slate-200 bg-white hover:border-slate-400'}`}>
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
                        <div className={`text-xs font-bold px-2.5 py-1 rounded-full ${availableStock <= 0 ? 'bg-rose-100 text-rose-600' : availableStock <= 3 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {availableStock <= 0 ? 'Out of Stock' : `${availableStock} left`}
                        </div>
                      </div>
                      <button onClick={() => { addToCart(p); setActiveTab('pos'); }} disabled={availableStock <= 0}
                        className={`w-full mt-3 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors ${availableStock <= 0 ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-900 hover:bg-slate-700 text-white'}`}
                      >
                        <ShoppingCart className="w-3.5 h-3.5" /> Add to Cart
                      </button>
                    </div>
                  )})}
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
                  {products.filter(p => p.active && p.stock > 0).map(p => {
                    const inCart = cart.find(c => c.productId === p.id)?.quantity || 0;
                    const availableStock = p.stock - inCart;
                    const isLowStock = availableStock > 0 && availableStock <= 5;
                    return (
                    <button key={p.id} onClick={() => addToCart(p)} disabled={availableStock <= 0}
                      className={`border bg-white rounded-xl p-3 text-left transition-all group relative overflow-hidden ${
                        availableStock <= 0 ? 'border-slate-100 opacity-50 cursor-not-allowed' : 'border-slate-200 hover:border-blue-900 hover:shadow-md'
                      }`}
                    >
                      {isLowStock && (
                        <span className="absolute top-2 right-2 text-[9px] font-black bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded border border-amber-300">
                          Low Stock
                        </span>
                      )}
                      <p className="text-sm font-bold text-slate-900 group-hover:text-blue-900">{p.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{p.category}</p>
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-base font-black text-blue-950">₹{p.price.toLocaleString('en-IN')}</p>
                        <span className={`text-xs font-bold ${
                          availableStock <= 0 ? 'text-rose-500' : isLowStock ? 'text-amber-700' : 'text-slate-500'
                        }`}>
                          {availableStock <= 0 ? 'Out of Stock' : `${availableStock} left`}
                        </span>
                      </div>
                    </button>
                  )})}
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
                      <div className="relative">
                        <label className="block text-xs font-bold text-slate-600 mb-1">Customer (optional)</label>
                        <div className="relative">
                          <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
                          <input 
                            type="text"
                            placeholder="Search by name, phone, NFC, fingerprint..."
                            value={posCustomerSearch}
                            onChange={e => {
                              setPosCustomerSearch(e.target.value);
                              setShowPosCustomerDropdown(true);
                              if (!e.target.value) { setPosCustomer(null); setPosCustomerName(''); }
                            }}
                            onFocus={() => setShowPosCustomerDropdown(true)}
                            className="w-full pl-8 pr-8 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:ring-2 focus:ring-slate-800 outline-none"
                          />
                          {posCustomer && (
                            <button onClick={() => { setPosCustomer(null); setPosCustomerName(''); setPosCustomerSearch(''); }} className="absolute right-2 top-2.5 text-slate-400 hover:text-rose-500">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        {showPosCustomerDropdown && posCustomerSearch && !posCustomer && (
                          <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 shadow-xl rounded-lg max-h-48 overflow-y-auto">
                            {customers.filter(c => 
                              c.name.toLowerCase().includes(posCustomerSearch.toLowerCase()) || 
                              c.phone.includes(posCustomerSearch) || 
                              c.nfcCardId.toLowerCase().includes(posCustomerSearch.toLowerCase()) || 
                              (c.fingerprintId && c.fingerprintId.toLowerCase().includes(posCustomerSearch.toLowerCase()))
                            ).slice(0, 10).map(c => (
                              <button key={c.id} onClick={() => {
                                setPosCustomer(c.id);
                                setPosCustomerName(c.name);
                                setPosCustomerSearch(`${c.name} (${c.phone})`);
                                setShowPosCustomerDropdown(false);
                              }} className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 border-b border-slate-50 last:border-0 flex items-center justify-between">
                                <div>
                                  <div className="font-bold text-slate-800">{c.name}</div>
                                  <div className="text-[10px] text-slate-500 flex items-center gap-1"><Phone className="w-2.5 h-2.5" /> {c.phone} {c.nfcCardId && <><CreditCard className="w-2.5 h-2.5" /> {c.nfcCardId}</>}</div>
                                </div>
                                {c.waActive && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    WA Active
                                  </span>
                                )}
                              </button>
                            ))}
                            {customers.filter(c => 
                              c.name.toLowerCase().includes(posCustomerSearch.toLowerCase()) || 
                              c.phone.includes(posCustomerSearch) || 
                              c.nfcCardId.toLowerCase().includes(posCustomerSearch.toLowerCase()) || 
                              (c.fingerprintId && c.fingerprintId.toLowerCase().includes(posCustomerSearch.toLowerCase()))
                            ).length === 0 && (
                              <div className="px-3 py-3 text-xs text-slate-500 text-center">No customers found matching "{posCustomerSearch}"</div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Payment Mode */}
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5">Payment Mode</label>
                        <div className="grid grid-cols-4 gap-1">
                          {(['CASH', 'UPI', 'CARD', 'SPLIT'] as const).map(m => (
                            <button key={m} onClick={() => setPosPaymentMethod(m)} className={`py-1.5 text-xs font-bold rounded-lg border transition-colors flex items-center justify-center gap-1 ${posPaymentMethod === m ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-400'}`}>
                              {m === 'CASH' ? <Banknote className="w-3 h-3" /> : m === 'UPI' ? <Smartphone className="w-3 h-3" /> : m === 'CARD' ? <CreditCard className="w-3 h-3" /> : <ArrowLeftRight className="w-3 h-3" />}
                              {m === 'SPLIT' ? 'Split' : m}
                            </button>
                          ))}
                        </div>
                        {posPaymentMethod === 'SPLIT' && (
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            <div><label className="text-xs text-slate-500 font-semibold">Cash (₹)</label><input type="number" value={posCashSplit} onChange={e => setPosCashSplit(e.target.value === '' ? '' : Number(e.target.value))} className="w-full px-2 py-1.5 mt-1 bg-white border border-slate-200 rounded text-xs" /></div>
                            <div><label className="text-xs text-slate-500 font-semibold">UPI (₹)</label><input type="number" value={posUpiSplit} onChange={e => setPosUpiSplit(e.target.value === '' ? '' : Number(e.target.value))} className="w-full px-2 py-1.5 mt-1 bg-white border border-slate-200 rounded text-xs" /></div>
                          </div>
                        )}
                      </div>

                        {posErrorMsg && (
                          <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700 flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                            <span>{posErrorMsg}</span>
                          </div>
                        )}

                        <button onClick={handleCheckout} disabled={checkoutLoading || cart.length === 0}
                          className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 transition-colors shadow-sm">
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
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                    <span>POS Store Sales ({productSales.length} orders)</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">Itemized transaction records for supplement, drink, and accessory sales</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={exportSalesCSV}
                    disabled={productSales.length === 0}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    <span>CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={exportSalesPDF}
                    disabled={productSales.length === 0}
                    className="px-3 py-1.5 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-40 text-emerald-900 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                  >
                    <FileText className="w-3.5 h-3.5 text-emerald-600" />
                    <span>PDF</span>
                  </button>
                </div>
              </div>

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
                          <p className="text-xs text-slate-500 font-mono font-medium">{formatDateDDMMYYYY(sale.date)} · {sale.paymentMethod}</p>
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
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
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
                <input type="number" value={pPrice} onChange={e => setPPrice(e.target.value === '' ? '' : Number(e.target.value))} min={0} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-800 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Stock Quantity</label>
                <input type="number" value={pStock} onChange={e => setPStock(e.target.value === '' ? '' : Number(e.target.value))} min={0} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-800 outline-none" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowProductModal(false)} className="flex-1 py-2.5 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={handleSaveProduct} disabled={!pName.trim() || Number(pPrice) <= 0 || savingProduct} className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-lg disabled:opacity-50 flex items-center justify-center gap-2">
                {savingProduct ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
                {editingProduct ? 'Save Changes' : 'Add Product'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-[110] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
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
