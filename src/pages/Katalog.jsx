import React, { useState, useEffect } from 'react';
import {
    Plus, Trash2, Download, Settings,
    List, Package, FileImage, Building2,
    Phone, Mail, Globe, MapPin, AlignLeft
} from 'lucide-react';

export default function App() {
    // html2pdf kütüphanesini güvenli bir şekilde yükleme
    const [pdfReady, setPdfReady] = useState(false);

    useEffect(() => {
        if (!window.html2pdf) {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
            script.async = true;
            script.onload = () => setPdfReady(true);
            document.body.appendChild(script);
            return () => {
                if (document.body.contains(script)) {
                    document.body.removeChild(script);
                }
            };
        } else {
            setPdfReady(true);
        }
    }, []);

    // --- STATE YÖNETİMİ ---
    const [activeTab, setActiveTab] = useState('settings');

    const [settings, setSettings] = useState({
        logo: '/firmalogo.jpg',
        companyName: 'AYSALED AYDINLATMA',
        catalogTitle: '2026 Ürün Kataloğu',
        catalogSubtitle: 'Profesyonel LED ve Alüminyum Çözümleri',
        defaultCurrency: 'TRY'
    });

    const [companyInfo, setCompanyInfo] = useState({
        about: 'Aysaled Aydınlatma olarak, yılların verdiği tecrübe ile sektörde yenilikçi, kaliteli ve sürdürülebilir aydınlatma çözümleri sunuyoruz. Müşteri memnuniyetini ön planda tutarak, mimari ve endüstriyel projelere özel tasarımlar geliştiriyor, enerji verimliliği yüksek ürünlerimizle geleceği aydınlatıyoruz.',
        phone: '0 212 916 11 00',
        email: 'info@aysaled.com',
        website: 'www.aysaled.com',
        address: 'İkitelli OSB Aykosan Sanayi Sitesi, Çarşı Bloğu Kat:1 No:3-4, İstanbul / Türkiye'
    });

    const [categories, setCategories] = useState([
        { id: 1, name: 'Trimless LED Profilleri' },
        { id: 2, name: 'Alçıpan & Gizli Işık Profilleri' },
        { id: 3, name: 'Standart / Özel Kanallar' },
    ]);

    const [products, setProducts] = useState([]);

    // --- HANDLERS ---
    const handleLogoUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setSettings(prev => ({ ...prev, logo: reader.result }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleProductImageUpload = (id, field, e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                updateProduct(id, field, reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const updateCompanyInfo = (field, value) => {
        setCompanyInfo(prev => ({ ...prev, [field]: value }));
    };

    const addCategory = () => {
        const name = prompt('Yeni Kategori Adı:');
        if (name && name.trim() !== '') {
            setCategories(prev => [...prev, { id: Date.now(), name }]);
        }
    };

    const deleteCategory = (id) => {
        if (window.confirm('Bu kategoriyi ve içindeki tüm ürünleri silmek istediğinize emin misiniz?')) {
            setCategories(prev => prev.filter(c => c.id !== id));
            setProducts(prev => prev.filter(p => p.categoryId !== id));
        }
    };

    const addProduct = () => {
        if (categories.length === 0) {
            alert('Lütfen önce bir kategori oluşturun.');
            return;
        }
        const newProduct = {
            id: Date.now(),
            categoryId: categories[0].id,
            code: '',
            name: 'Yeni Ürün',
            image: null,
            techImage: null,
            features: [{ key: '', value: '' }],
            price: '',
            currency: settings.defaultCurrency,
            showPrice: true
        };
        setProducts(prev => [...prev, newProduct]);
        setActiveTab('products');
    };

    const updateProduct = (id, field, value) => {
        setProducts(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
    };

    const addFeature = (productId) => {
        setProducts(prev => prev.map(p => {
            if (p.id === productId) {
                return { ...p, features: [...(p.features || []), { key: '', value: '' }] };
            }
            return p;
        }));
    };

    const updateFeature = (productId, index, field, value) => {
        setProducts(prev => prev.map(p => {
            if (p.id === productId) {
                const newFeatures = [...(p.features || [])];
                if (newFeatures[index]) {
                    newFeatures[index][field] = value;
                }
                return { ...p, features: newFeatures };
            }
            return p;
        }));
    };

    const removeFeature = (productId, index) => {
        setProducts(prev => prev.map(p => {
            if (p.id === productId) {
                const newFeatures = (p.features || []).filter((_, i) => i !== index);
                return { ...p, features: newFeatures };
            }
            return p;
        }));
    };

    const deleteProduct = (id) => {
        if (window.confirm('Bu ürünü silmek istediğinize emin misiniz?')) {
            setProducts(prev => prev.filter(p => p.id !== id));
        }
    };

    const exportPDF = () => {
        if (!pdfReady || !window.html2pdf) {
            alert('PDF oluşturucu henüz yüklenmedi, lütfen birkaç saniye bekleyip tekrar deneyin.');
            return;
        }

        const element = document.getElementById('pdf-preview-container');
        if (!element) return;

        window.scrollTo(0, 0); // En tepeye kaydır

        const opt = {
            margin: 0,
            filename: `${settings.companyName.replace(/\s+/g, '-')}-Katalog.pdf`,
            image: { type: 'jpeg', quality: 1 },
            html2canvas: {
                scale: 2,
                useCORS: true,
                logging: false,
                scrollY: 0
                // Sola kayma yapmaması için width/windowWidth zorlamalarını kaldırdık. 
                // 210mm'yi kendi doğal boyutunda algılayacak.
            },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak: { mode: ['css', 'legacy'], avoid: ['.page-break-avoid'] }
        };

        window.html2pdf().set(opt).from(element).save();
    };

    const getCurrencySymbol = (code) => {
        switch (code) {
            case 'USD': return '$';
            case 'TRY': return '₺';
            case 'EUR': return '€';
            default: return code;
        }
    };

    // --- RENDERERS FOR LEFT PANEL ---
    const renderSettingsTab = () => (
        <div className="space-y-6 animate-fadeIn">
            <div>
                <h3 className="text-lg font-semibold mb-4 border-b pb-2 flex items-center">
                    <Settings size={18} className="mr-2 text-green-600" /> Katalog Ayarları
                </h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Firma Logosu (Önerilen: Yatay, Transparan PNG/JPG)</label>
                        <div className="flex items-center space-x-4">
                            <div className="h-24 w-full border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50 overflow-hidden relative group cursor-pointer hover:bg-gray-100 transition">
                                {settings.logo ? (
                                    <img src={settings.logo} alt="Logo" className="max-h-full max-w-full object-contain p-2" />
                                ) : (
                                    <div className="text-center">
                                        <FileImage className="mx-auto text-gray-400 mb-1" size={24} />
                                        <span className="text-xs text-gray-500 font-medium">Logoyu Yüklemek İçin Tıklayın</span>
                                    </div>
                                )}
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleLogoUpload}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Kısa Firma Adı</label>
                            <input
                                type="text" value={settings.companyName} onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                                className="w-full p-2 border rounded-md focus:ring-green-500 focus:border-green-500 bg-white"
                            />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Katalog Ana Başlığı</label>
                            <input
                                type="text" value={settings.catalogTitle} onChange={(e) => setSettings({ ...settings, catalogTitle: e.target.value })}
                                className="w-full p-2 border rounded-md focus:ring-green-500 focus:border-green-500 bg-white"
                            />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Katalog Alt Başlığı (Slogan vb.)</label>
                            <input
                                type="text" value={settings.catalogSubtitle} onChange={(e) => setSettings({ ...settings, catalogSubtitle: e.target.value })}
                                className="w-full p-2 border rounded-md focus:ring-green-500 focus:border-green-500 bg-white"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Varsayılan Para Birimi</label>
                        <select
                            value={settings.defaultCurrency} onChange={(e) => setSettings({ ...settings, defaultCurrency: e.target.value })}
                            className="w-full p-2 border rounded-md focus:ring-green-500 focus:border-green-500 bg-white"
                        >
                            <option value="USD">Dolar ($)</option>
                            <option value="TRY">Türk Lirası (₺)</option>
                            <option value="EUR">Euro (€)</option>
                        </select>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderCompanyTab = () => (
        <div className="space-y-6 animate-fadeIn">
            <div>
                <h3 className="text-lg font-semibold mb-4 border-b pb-2 flex items-center">
                    <Building2 size={18} className="mr-2 text-green-600" /> Kurumsal Bilgiler
                </h3>
                <p className="text-xs text-gray-500 mb-4">Bu bilgiler kataloğun 2. sayfasında (Hakkımızda) ve arka kapakta gösterilir.</p>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Hakkımızda Yazısı</label>
                        <textarea
                            rows={4}
                            value={companyInfo.about} onChange={(e) => updateCompanyInfo('about', e.target.value)}
                            className="w-full p-2 border rounded-md focus:ring-green-500 focus:border-green-500 bg-white text-sm"
                            placeholder="Firmanızı kısaca tanıtın..."
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Telefon</label>
                            <div className="flex"><span className="inline-flex items-center px-2 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500"><Phone size={14} /></span>
                                <input type="text" value={companyInfo.phone} onChange={(e) => updateCompanyInfo('phone', e.target.value)} className="w-full p-2 border rounded-r-md text-sm" /></div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">E-Posta</label>
                            <div className="flex"><span className="inline-flex items-center px-2 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500"><Mail size={14} /></span>
                                <input type="email" value={companyInfo.email} onChange={(e) => updateCompanyInfo('email', e.target.value)} className="w-full p-2 border rounded-r-md text-sm" /></div>
                        </div>
                        <div className="col-span-2">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Web Sitesi</label>
                            <div className="flex"><span className="inline-flex items-center px-2 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500"><Globe size={14} /></span>
                                <input type="text" value={companyInfo.website} onChange={(e) => updateCompanyInfo('website', e.target.value)} className="w-full p-2 border rounded-r-md text-sm" /></div>
                        </div>
                        <div className="col-span-2">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Açık Adres</label>
                            <textarea
                                rows={2} value={companyInfo.address} onChange={(e) => updateCompanyInfo('address', e.target.value)}
                                className="w-full p-2 border rounded-md text-sm"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderCategoriesTab = () => (
        <div className="space-y-4 animate-fadeIn">
            <div className="flex justify-between items-center border-b pb-2">
                <h3 className="text-lg font-semibold flex items-center">
                    <List size={18} className="mr-2 text-green-600" /> Kategoriler
                </h3>
                <button
                    onClick={addCategory}
                    className="flex items-center px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition shadow-sm"
                >
                    <Plus size={16} className="mr-1" /> Ekle
                </button>
            </div>
            <p className="text-xs text-gray-500">Bu kategoriler "İçindekiler" bölümünde otomatik listelenecektir.</p>

            <div className="space-y-2 mt-4">
                {categories.map(cat => (
                    <div key={cat.id} className="flex justify-between items-center p-3 bg-white border rounded-md shadow-sm group">
                        <span className="font-medium text-gray-800">{cat.name}</span>
                        <button onClick={() => deleteCategory(cat.id)} className="text-gray-400 hover:text-red-500 transition p-1">
                            <Trash2 size={16} />
                        </button>
                    </div>
                ))}
                {categories.length === 0 && (
                    <div className="text-center py-8 bg-white border border-dashed rounded-md">
                        <p className="text-sm text-gray-500">Kategori bulunamadı.</p>
                    </div>
                )}
            </div>
        </div>
    );

    const renderProductsTab = () => (
        <div className="space-y-6 animate-fadeIn">
            <div className="flex justify-between items-center border-b pb-2">
                <h3 className="text-lg font-semibold flex items-center">
                    <Package size={18} className="mr-2 text-green-600" /> Ürün Yönetimi
                </h3>
                <button
                    onClick={addProduct}
                    className="flex items-center px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition shadow-sm"
                >
                    <Plus size={16} className="mr-1" /> Yeni Ürün
                </button>
            </div>

            <div className="space-y-6">
                {products.map((product) => (
                    <div key={product.id} className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm relative group hover:border-green-300 transition">
                        <button
                            onClick={() => deleteProduct(product.id)}
                            className="absolute -top-3 -right-3 bg-white border text-gray-400 hover:text-red-500 hover:border-red-200 rounded-full p-1.5 shadow-sm transition z-10 opacity-0 group-hover:opacity-100"
                            title="Ürünü Sil"
                        >
                            <Trash2 size={16} />
                        </button>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            {/* Sol Sütun - Temel Bilgiler */}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Bağlı Kategori</label>
                                    <select
                                        value={product.categoryId}
                                        onChange={(e) => updateProduct(product.id, 'categoryId', Number(e.target.value))}
                                        className="w-full p-2 border rounded-md text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-green-500 outline-none transition"
                                    >
                                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>

                                <div className="flex gap-3">
                                    <div className="w-1/3">
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Ürün Kodu</label>
                                        <input
                                            type="text" value={product.code} placeholder="Örn: AYS-01"
                                            onChange={(e) => updateProduct(product.id, 'code', e.target.value)}
                                            className="w-full p-2 border rounded-md text-sm focus:ring-2 focus:ring-green-500 outline-none"
                                        />
                                    </div>
                                    <div className="w-2/3">
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Ürün Adı</label>
                                        <input
                                            type="text" value={product.name} placeholder="Ürün adı..."
                                            onChange={(e) => updateProduct(product.id, 'name', e.target.value)}
                                            className="w-full p-2 border rounded-md text-sm font-medium focus:ring-2 focus:ring-green-500 outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-3 items-end bg-gray-50 p-2 rounded-md border border-gray-100">
                                    <div className="flex-1">
                                        <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Fiyat Belirle</label>
                                        <div className="flex shadow-sm">
                                            <input
                                                type="number" value={product.price} placeholder="0.00"
                                                onChange={(e) => updateProduct(product.id, 'price', e.target.value)}
                                                className="w-full min-w-[60px] p-1.5 border rounded-l-md text-sm focus:z-10 focus:ring-1 focus:ring-green-500 outline-none"
                                            />
                                            <select
                                                value={product.currency}
                                                onChange={(e) => updateProduct(product.id, 'currency', e.target.value)}
                                                className="p-1.5 border border-l-0 rounded-r-md text-sm bg-white"
                                            >
                                                <option value="USD">$</option>
                                                <option value="TRY">₺</option>
                                                <option value="EUR">€</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="flex items-center h-8 px-2">
                                        <label className="flex items-center space-x-2 text-sm cursor-pointer select-none">
                                            <input
                                                type="checkbox"
                                                checked={product.showPrice}
                                                onChange={(e) => updateProduct(product.id, 'showPrice', e.target.checked)}
                                                className="rounded text-green-600 focus:ring-green-500 w-4 h-4 cursor-pointer"
                                            />
                                            <span className="text-gray-700 font-medium text-xs">Fiyatı Göster</span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* Sağ Sütun - Görsel ve Özellikler */}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Görseller (Ana Görsel & Teknik Çizim)</label>
                                    <div className="flex items-center space-x-2">
                                        {/* Ana Görsel Kutusu */}
                                        <div className="h-24 flex-1 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center bg-gray-50 relative overflow-hidden group hover:border-green-400 transition cursor-pointer">
                                            {product.image ? (
                                                <img src={product.image} alt="Product" className="object-cover w-full h-full p-1" />
                                            ) : (
                                                <FileImage size={20} className="text-gray-300 group-hover:text-green-400 transition mb-1" />
                                            )}
                                            <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[9px] text-center py-0.5 font-medium tracking-wider">
                                                ANA GÖRSEL
                                            </div>
                                            <input
                                                type="file" accept="image/*"
                                                onChange={(e) => handleProductImageUpload(product.id, 'image', e)}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                title="Ana Görsel Yükle"
                                            />
                                        </div>

                                        {/* Teknik Çizim Kutusu */}
                                        <div className="h-24 flex-1 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center bg-gray-50 relative overflow-hidden group hover:border-green-400 transition cursor-pointer">
                                            {product.techImage ? (
                                                <img src={product.techImage} alt="Tech Draw" className="object-cover w-full h-full p-1" />
                                            ) : (
                                                <FileImage size={20} className="text-gray-300 group-hover:text-green-400 transition mb-1" />
                                            )}
                                            <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[9px] text-center py-0.5 font-medium tracking-wider">
                                                TEKNİK ÇİZİM
                                            </div>
                                            <input
                                                type="file" accept="image/*"
                                                onChange={(e) => handleProductImageUpload(product.id, 'techImage', e)}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                title="Teknik Çizim Yükle"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="block text-xs font-medium text-gray-500">Teknik Özellik Tablosu</label>
                                        <button onClick={() => addFeature(product.id)} className="text-[10px] uppercase font-bold bg-green-50 text-green-700 px-2 py-1 rounded hover:bg-green-100 transition">
                                            + Satır Ekle
                                        </button>
                                    </div>
                                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                                        {product.features && product.features.map((feat, fIndex) => (
                                            <div key={fIndex} className="flex gap-1.5 items-center">
                                                <input
                                                    type="text" value={feat.key} placeholder="Özellik"
                                                    onChange={(e) => updateFeature(product.id, fIndex, 'key', e.target.value)}
                                                    className="w-2/5 min-w-[60px] p-1.5 border rounded text-xs bg-gray-50 focus:bg-white focus:ring-1 focus:ring-green-500 outline-none"
                                                />
                                                <input
                                                    type="text" value={feat.value} placeholder="Değer"
                                                    onChange={(e) => updateFeature(product.id, fIndex, 'value', e.target.value)}
                                                    className="flex-1 min-w-[60px] p-1.5 border rounded text-xs focus:ring-1 focus:ring-green-500 outline-none"
                                                />
                                                <button
                                                    onClick={() => removeFeature(product.id, fIndex)}
                                                    className="p-1.5 text-gray-400 hover:text-red-500 bg-gray-50 rounded hover:bg-red-50 transition"
                                                    title="Sil"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
                {products.length === 0 && (
                    <div className="text-center py-12 bg-white border border-gray-200 rounded-xl shadow-sm">
                        <Package className="mx-auto text-gray-300 mb-3" size={40} />
                        <p className="text-gray-800 font-medium">Kataloğunuzda henüz ürün yok.</p>
                        <p className="text-gray-500 text-sm mt-1 mb-4">Müşterilerinize sunmak için ilk ürününüzü ekleyin.</p>
                        <button onClick={addProduct} className="px-4 py-2 bg-green-600 text-white text-sm rounded-md shadow-sm hover:bg-green-700">
                            Ürün Ekle
                        </button>
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className="h-screen w-full bg-gray-100 flex flex-col lg:flex-row font-sans overflow-hidden">
            {/* Özel CSS ve PDF Baskı Ayarları */}
            <style dangerouslySetInnerHTML={{
                __html: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
        
        #pdf-preview-container {
          font-family: 'Inter', sans-serif;
          width: 210mm;
          background-color: white;
        }
        
        /* Sabit sayfalar (Kapak, İçindekiler, Arka Kapak) için milimetrik A4 boyutu */
        .pdf-page {
          width: 210mm;
          height: 296mm; /* Taşmaları ve boş sayfaları engellemek için 297mm yerine 296mm yapıldı */
          background: white;
          position: relative;
          overflow: hidden;
          box-sizing: border-box;
          page-break-after: always;
          break-after: page;
        }

        /* Akan ürün içerik sayfaları için esnek yükseklik */
        .pdf-page-content {
          width: 210mm;
          min-height: 296mm; /* Taşmaları engellemek için 297mm yerine 296mm yapıldı */
          background: white;
          position: relative;
          box-sizing: border-box;
          padding: 15mm;
        }

        /* Sayfalar arasında ekran önizlemesi için kılavuz çizgisi (PDF'e basılmaz) */
        @media screen {
          .screen-divider {
            border-bottom: 2px dashed #cbd5e1;
          }
        }

        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none; }
          .page-break-avoid { page-break-inside: avoid; break-inside: avoid; }
          .screen-divider { border-bottom: none; }
        }
        
        /* Custom Scrollbar for Left Panel */
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f1f1f1; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #c1c1c1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #a8a8a8; }
      `}} />

            {/* --- SOL PANEL (KONTROLLER) --- */}
            <div className="w-full lg:w-[500px] bg-white border-r flex flex-col h-[50vh] lg:h-full shadow-[4px_0_24px_rgba(0,0,0,0.05)] z-20 flex-shrink-0">
                <div className="p-5 bg-gradient-to-r from-green-700 to-green-600 text-white">
                    <h1 className="text-xl font-bold flex items-center">
                        <AlignLeft className="mr-2 opacity-80" /> Katalog Yönetimi
                    </h1>
                    <p className="text-green-100 text-sm mt-1 opacity-90">Profesyonel PDF Oluşturucu</p>
                </div>

                {/* Sekmeler */}
                <div className="flex border-b text-xs font-semibold uppercase tracking-wider bg-gray-50">
                    <button
                        onClick={() => setActiveTab('settings')}
                        className={`flex-1 py-3.5 flex justify-center items-center transition ${activeTab === 'settings' ? 'border-b-2 border-green-600 text-green-700 bg-white' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
                    >
                        Genel
                    </button>
                    <button
                        onClick={() => setActiveTab('company')}
                        className={`flex-1 py-3.5 flex justify-center items-center transition ${activeTab === 'company' ? 'border-b-2 border-green-600 text-green-700 bg-white' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
                    >
                        Firma
                    </button>
                    <button
                        onClick={() => setActiveTab('categories')}
                        className={`flex-1 py-3.5 flex justify-center items-center transition ${activeTab === 'categories' ? 'border-b-2 border-green-600 text-green-700 bg-white' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
                    >
                        Kategoriler
                    </button>
                    <button
                        onClick={() => setActiveTab('products')}
                        className={`flex-1 py-3.5 flex justify-center items-center transition ${activeTab === 'products' ? 'border-b-2 border-green-600 text-green-700 bg-white' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
                    >
                        Ürünler
                    </button>
                </div>

                {/* Sekme İçerikleri */}
                <div className="flex-1 overflow-y-auto p-5 bg-gray-50/50 custom-scrollbar">
                    {activeTab === 'settings' && renderSettingsTab()}
                    {activeTab === 'company' && renderCompanyTab()}
                    {activeTab === 'categories' && renderCategoriesTab()}
                    {activeTab === 'products' && renderProductsTab()}
                </div>

                {/* Dışa Aktar Butonu */}
                <div className="p-5 bg-white border-t shadow-[0_-4px_10px_rgba(0,0,0,0.02)]">
                    <button
                        onClick={exportPDF}
                        className="w-full py-3.5 bg-gray-900 hover:bg-black text-white font-bold rounded-lg flex justify-center items-center shadow-lg transition transform hover:-translate-y-0.5"
                    >
                        <Download className="mr-2" size={20} /> Yüksek Çözünürlüklü PDF İndir
                    </button>
                    <p className="text-center text-[10px] text-gray-400 mt-2">İndirmeden önce sağ taraftaki önizlemeyi kontrol edin.</p>
                </div>
            </div>

            {/* --- SAĞ PANEL (CANLI ÖNİZLEME) --- */}
            <div className="flex-1 h-[50vh] lg:h-full bg-gray-500 overflow-y-auto p-4 lg:p-10 flex flex-col items-center custom-scrollbar">

                {/* PDF Wrapper: Gölgeyi ve ortalamayı sağlayan dış katman */}
                <div className="shadow-[0_20px_50px_rgba(0,0,0,0.3)] bg-white">

                    {/* ASIL PDF KAPSAYICISI (SIFIR BOŞLUK, SIFIR GRİ ARKA PLAN) */}
                    <div id="pdf-preview-container" className="flex flex-col bg-white">

                        {/* ================= 1. KAPAK SAYFASI (Front Cover) ================= */}
                        <div className="pdf-page bg-slate-900 flex flex-col relative screen-divider">
                            {/* Üst Dekoratif Alan (PDF Motorunun hatasız işlemesi için SVG kullanıldı) */}
                            <div className="absolute top-0 left-0 w-full h-80 z-0 pointer-events-none">
                                <svg preserveAspectRatio="none" viewBox="0 0 100 100" className="w-full h-full">
                                    <polygon fill="#16a34a" points="0,0 100,0 100,100 0,60" />
                                </svg>
                            </div>

                            <div className="flex-1 flex flex-col justify-center items-center px-16 text-center z-10 pt-16">
                                {/* Logo Alanı */}
                                <div className="bg-white p-8 rounded-2xl shadow-2xl mb-12 min-h-[140px] w-4/5 flex items-center justify-center transform hover:scale-105 transition duration-500">
                                    {settings.logo ? (
                                        <img src={settings.logo} alt="Firma Logosu" className="max-h-24 w-full object-contain" />
                                    ) : (
                                        <h1 className="text-4xl font-black text-slate-800 tracking-wider uppercase">
                                            {settings.companyName}
                                        </h1>
                                    )}
                                </div>

                                {/* Başlık Alanı */}
                                <h1 className="text-6xl font-black text-white leading-tight tracking-tight mb-4 drop-shadow-lg">
                                    {settings.catalogTitle.split(' ').map((word, i) => (
                                        <React.Fragment key={i}>
                                            {i === 0 ? <span className="text-green-500">{word}</span> : word}{' '}
                                        </React.Fragment>
                                    ))}
                                </h1>

                                <div className="w-24 h-1.5 bg-green-500 mb-6 rounded-full"></div>

                                <p className="text-gray-300 tracking-[0.25em] uppercase text-sm font-semibold">
                                    {settings.catalogSubtitle}
                                </p>
                            </div>

                            {/* Alt Footer Bölümü */}
                            <div className="h-32 bg-slate-950 flex flex-col items-center justify-center pb-4 border-t border-slate-800 z-10 relative">
                                <p className="text-green-500 tracking-widest text-xs uppercase font-bold mb-1">{settings.companyName}</p>
                                <p className="text-gray-500 text-[10px] uppercase">{new Date().getFullYear()} Koleksiyonu</p>
                            </div>
                        </div>

                        {/* ================= 2. İÇİNDEKİLER VE HAKKIMIZDA (Index Page) ================= */}
                        <div className="pdf-page bg-white p-[15mm] flex flex-col screen-divider">
                            <div className="flex justify-between items-end border-b-2 border-slate-900 pb-4 mb-10">
                                <h2 className="text-4xl font-black text-slate-900 tracking-tight">HAKKIMIZDA <span className="text-green-600">&</span> İÇİNDEKİLER</h2>
                                {settings.logo && <img src={settings.logo} className="h-10 object-contain" alt="Logo mini" />}
                            </div>

                            <div className="flex gap-12 flex-1">
                                {/* Sol: Hakkımızda */}
                                <div className="w-1/2 flex flex-col">
                                    <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center">
                                        <span className="w-8 h-1 bg-green-600 mr-3"></span> Biz Kimiz?
                                    </h3>
                                    <p className="text-slate-600 leading-relaxed text-sm text-justify mb-10">
                                        {companyInfo.about}
                                    </p>

                                    <div className="mt-auto bg-slate-50 p-6 rounded-xl border border-slate-100">
                                        <h4 className="text-sm font-bold text-slate-800 mb-4 uppercase tracking-wider">İletişim</h4>
                                        <div className="space-y-3 text-sm text-slate-600">
                                            <div className="flex items-center"><Phone size={16} className="text-green-600 mr-3" /> {companyInfo.phone}</div>
                                            <div className="flex items-center"><Mail size={16} className="text-green-600 mr-3" /> {companyInfo.email}</div>
                                            <div className="flex items-center"><Globe size={16} className="text-green-600 mr-3" /> {companyInfo.website}</div>
                                            <div className="flex items-start mt-2 pt-2 border-t border-slate-200">
                                                <MapPin size={16} className="text-green-600 mr-3 mt-1 flex-shrink-0" />
                                                <span className="leading-snug">{companyInfo.address}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Sağ: İçindekiler */}
                                <div className="w-1/2">
                                    <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center">
                                        <span className="w-8 h-1 bg-green-600 mr-3"></span> Kategoriler
                                    </h3>
                                    <div className="space-y-4">
                                        {categories.map((cat, index) => (
                                            <div key={cat.id} className="flex items-center text-sm">
                                                <span className="text-green-600 font-bold text-lg w-8">{(index + 1).toString().padStart(2, '0')}</span>
                                                <span className="font-semibold text-slate-700 flex-1 uppercase tracking-wide">{cat.name}</span>
                                                <div className="flex-1 border-b border-dotted border-gray-300 mx-3 relative top-2"></div>
                                                <span className="text-gray-400 font-medium text-xs">Bölüm</span>
                                            </div>
                                        ))}
                                        {categories.length === 0 && <p className="text-sm text-gray-400 italic">Kategori listesi boş.</p>}
                                    </div>
                                </div>
                            </div>

                            <div className="text-center text-[10px] text-gray-400 uppercase tracking-widest mt-8 border-t pt-4">
                                Sayfa 02
                            </div>
                        </div>

                        {/* ================= 3. İÇERİK SAYFALARI (Products Dynamic Pages) ================= */}
                        <div className="pdf-page-content screen-divider">
                            <div className="space-y-16">
                                {categories.map((category, catIndex) => {
                                    const categoryProducts = products.filter(p => p.categoryId === category.id);
                                    if (categoryProducts.length === 0) return null;

                                    return (
                                        <div key={category.id} className="page-break-avoid w-full mb-12">

                                            {/* Kategori Özel Başlık Banner'ı */}
                                            <div className="bg-slate-900 text-white p-6 rounded-xl mb-8 flex items-center justify-between shadow-md border-l-8 border-green-500">
                                                <div>
                                                    <span className="text-green-400 font-bold tracking-widest text-xs uppercase block mb-1">Bölüm {(catIndex + 1).toString().padStart(2, '0')}</span>
                                                    <h2 className="text-3xl font-black uppercase tracking-tight">{category.name}</h2>
                                                </div>
                                                <Package size={40} className="text-slate-700 opacity-50" />
                                            </div>

                                            {/* Ürünler Listesi (Tek Sütun / Yatay Tasarım) */}
                                            <div className="flex flex-col gap-6">
                                                {categoryProducts.map(product => (
                                                    <div key={product.id} className="page-break-avoid flex flex-row items-stretch bg-white border-2 border-slate-100 rounded-xl overflow-hidden shadow-sm">

                                                        {/* Görsel Kutusu (Sol Kısım) */}
                                                        <div className="w-5/12 bg-gray-50 p-4 relative flex gap-4 items-center justify-center border-r-2 border-slate-100 min-h-[220px]">
                                                            {/* Dekoratif Köşe Etiketi */}
                                                            <div className="absolute top-0 left-0 bg-green-600 text-white text-[10px] font-bold px-3 py-1 rounded-br-lg z-10 tracking-widest">
                                                                {product.code || 'KOD YOK'}
                                                            </div>

                                                            {!product.image && !product.techImage ? (
                                                                <div className="text-gray-300 flex flex-col items-center opacity-40">
                                                                    <FileImage size={40} className="mb-2" />
                                                                    <span className="uppercase tracking-widest text-[10px] font-bold">Görsel Yok</span>
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    {product.image && (
                                                                        <div className={`flex items-center justify-center h-full ${product.techImage ? 'w-1/2' : 'w-full'}`}>
                                                                            <img src={product.image} alt={product.name} className="max-h-full max-w-full object-contain drop-shadow-md" />
                                                                        </div>
                                                                    )}
                                                                    {product.techImage && (
                                                                        <div className={`flex items-center justify-center h-full ${product.image ? 'w-1/2' : 'w-full'}`}>
                                                                            <img src={product.techImage} alt={`${product.name} Teknik`} className="max-h-full max-w-full object-contain drop-shadow-sm mix-blend-multiply" />
                                                                        </div>
                                                                    )}
                                                                </>
                                                            )}
                                                        </div>

                                                        {/* Ürün Detayları (Sağ Kısım) */}
                                                        <div className="w-7/12 p-6 flex flex-col flex-1">
                                                            <div className="flex justify-between items-start gap-2 mb-4">
                                                                <h3 className="text-xl font-black text-slate-800 leading-tight uppercase">{product.name}</h3>
                                                                {product.showPrice && product.price && (
                                                                    <div className="text-right flex-shrink-0 bg-green-50 text-green-700 px-3 py-1.5 rounded border border-green-100">
                                                                        <span className="text-lg font-black">
                                                                            {getCurrencySymbol(product.currency)}{product.price}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Teknik Özellikler Tablosu */}
                                                            <div className="mt-auto pt-4 border-t-2 border-slate-100">
                                                                {product.features && product.features.length > 0 && product.features[0].key !== '' ? (
                                                                    <table className="w-full text-sm">
                                                                        <tbody>
                                                                            {product.features.map((feat, idx) => {
                                                                                if (!feat.key && !feat.value) return null;
                                                                                return (
                                                                                    <tr key={idx} className="border-b border-slate-50 last:border-0">
                                                                                        <td className="py-2 text-slate-500 font-semibold w-2/5 pr-2">{feat.key}</td>
                                                                                        <td className="py-2 text-slate-900 font-bold text-right">{feat.value}</td>
                                                                                    </tr>
                                                                                );
                                                                            })}
                                                                        </tbody>
                                                                    </table>
                                                                ) : (
                                                                    <div className="text-sm text-gray-400 italic py-2">Teknik özellik belirtilmemiş.</div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}

                                {products.length === 0 && (
                                    <div className="text-center py-32 text-gray-400 border-2 border-dashed border-gray-300 rounded-xl mx-10">
                                        <p className="text-2xl font-bold mb-2">Katalog İçeriği Boş</p>
                                        <p className="text-sm">Yönetim panelinden kategoriler ve ürünler eklediğinizde burada listelenecektir.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Kesin Sayfa Bölme (Arka kapağın yeni sayfaya temiz geçmesi için) */}
                        <div className="html2pdf__page-break"></div>

                        {/* ================= 4. ARKA KAPAK (Back Cover) ================= */}
                        <div className="pdf-page bg-slate-900 flex flex-col text-white">
                            <div className="flex-1 flex flex-col justify-center items-center px-16 text-center">

                                <div className="w-16 h-1 bg-green-500 mb-8 rounded-full"></div>

                                <h2 className="text-4xl font-black mb-4 uppercase tracking-wider">Bize Ulaşın</h2>
                                <p className="text-gray-400 text-sm mb-12 max-w-md mx-auto font-light">
                                    Projeleriniz için özel aydınlatma çözümleri, fiyat teklifleri ve teknik destek almak için uzman ekibimizle iletişime geçin.
                                </p>

                                <div className="bg-slate-800/50 p-8 rounded-2xl border border-slate-700 w-full max-w-lg backdrop-blur-sm">
                                    <div className="space-y-6 text-left">
                                        <div className="flex items-center">
                                            <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center mr-4 flex-shrink-0">
                                                <Phone size={20} className="text-white" />
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-400 uppercase tracking-wider font-bold mb-0.5">Müşteri Hizmetleri</p>
                                                <p className="font-semibold text-lg">{companyInfo.phone}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center">
                                            <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center mr-4 flex-shrink-0">
                                                <Mail size={20} className="text-white" />
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-400 uppercase tracking-wider font-bold mb-0.5">E-Posta</p>
                                                <p className="font-semibold text-lg">{companyInfo.email}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center">
                                            <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center mr-4 flex-shrink-0">
                                                <MapPin size={20} className="text-white" />
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-400 uppercase tracking-wider font-bold mb-0.5">Merkez Ofis & Fabrika</p>
                                                <p className="font-semibold text-sm leading-snug">{companyInfo.address}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="h-40 bg-slate-950 flex flex-col items-center justify-center relative overflow-hidden">
                                <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
                                {settings.logo ? (
                                    <img src={settings.logo} className="h-12 object-contain mb-3 z-10 brightness-0 invert opacity-70" alt="Logo White" />
                                ) : (
                                    <h3 className="text-xl font-bold tracking-widest text-gray-500 z-10">{settings.companyName}</h3>
                                )}
                                <p className="text-green-600 text-xs tracking-widest font-bold z-10">{companyInfo.website}</p>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}