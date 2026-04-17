import React, { useState, useEffect, useCallback } from 'react';
import {
    Plus, Trash2, Download, Settings,
    List, Package, FileImage, Building2,
    Phone, Mail, Globe, MapPin, AlignLeft,
    Save, Loader2, Zap
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabaseClient';
import MediaPickerModal from '../components/MediaPickerModal';

const TEMPLATES = {
    modern: {
        id: 'modern',
        name: 'Modern (Yeşil Vurgu)',
        colors: {
            bgPrimary: '#0f172a', // slate-900 equivalent
            bgSecondary: '#f8fafc', // slate-50
            accent: '#16a34a', // green-600 equivalent
            textMain: '#1e293b',
            textLight: '#64748b',
            textInverse: '#ffffff',
            border: '#e2e8f0',
            bgDark: '#020617', // slate-950
            coverTextBody: '#cbd5e1'
        }
    },
    classic: {
        id: 'classic',
        name: 'Klasik (Sade Beyaz)',
        colors: {
            bgPrimary: '#ffffff',
            bgSecondary: '#ffffff',
            accent: '#475569', // slate-600
            textMain: '#000000',
            textLight: '#64748b',
            textInverse: '#ffffff',
            border: '#cbd5e1',
            bgDark: '#f8fafc',
            coverTextBody: '#475569'
        }
    },
    minimal: {
        id: 'minimal',
        name: 'Minimal (Açık Gri)',
        colors: {
            bgPrimary: '#f1f5f9',
            bgSecondary: '#ffffff',
            accent: '#0f172a', // slate-900
            textMain: '#334155',
            textLight: '#94a3b8',
            textInverse: '#ffffff',
            border: '#e2e8f0',
            bgDark: '#e2e8f0',
            coverTextBody: '#64748b'
        }
    },
    energetic: {
        id: 'energetic',
        name: 'Enerjik (Turuncu Vurgu)',
        colors: {
            bgPrimary: '#fff7ed', // orange-50
            bgSecondary: '#ffffff',
            accent: '#ea580c', // orange-600
            textMain: '#312e81', // indigo-900
            textLight: '#94a3b8',
            textInverse: '#ffffff',
            border: '#fdba74', // orange-300
            bgDark: '#ffedd5',
            coverTextBody: '#ea580c'
        }
    },
    night: {
        id: 'night',
        name: 'Gece (Koyu Lacivert)',
        colors: {
            bgPrimary: '#1e1b4b', // indigo-950
            bgSecondary: '#e0e7ff', // indigo-100
            accent: '#6366f1', // indigo-500
            textMain: '#1e1b4b', // indigo-950
            textLight: '#6366f1', // indigo-500
            textInverse: '#ffffff',
            border: '#c7d2fe', // indigo-200
            bgDark: '#111827',
            coverTextBody: '#a5b4fc'
        }
    }
};

export default function App() {
    const { effectiveMode, currentColor } = useTheme();
    const isDark = effectiveMode === 'dark';

    // html2pdf kütüphanesini güvenli bir şekilde yükleme
    const [pdfReady, setPdfReady] = useState(false);
    const [pdfLoading, setPdfLoading] = useState(false);

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
        defaultCurrency: 'TRY',
        template: 'modern'
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

    // --- Media Picker Modal State ---
    const [mediaModalOpen, setMediaModalOpen] = useState(false);
    const [mediaTarget, setMediaTarget] = useState(null);

    // --- Supabase Catalogs State ---
    const [savedCatalogs, setSavedCatalogs] = useState([]);
    const [selectedCatalogId, setSelectedCatalogId] = useState(null);
    const [saving, setSaving] = useState(false);
    
    // YENİ EK: Kategori içi state'ler
    const [newCatName, setNewCatName] = useState('');
    const [newCatSubtitle, setNewCatSubtitle] = useState('Yapılarınıza\nIşıltılı\nGözlerle\nBakın');

    useEffect(() => {
        loadCatalogs();
    }, []);

    const loadCatalogs = async () => {
        try {
            const { data, error } = await supabase.from('catalogs').select('id, title, updated_at').order('created_at', { ascending: false });
            if (!error && data) {
                setSavedCatalogs(data);
            }
        } catch (err) {
            console.error('Kataloglar yüklenirken hata. Lütfen supabase tarafını kontrol edin.:', err);
        }
    };

    const saveCatalog = async () => {
        setSaving(true);
        try {
            const dataToSave = {
                settings,
                companyInfo,
                categories,
                products
            };

            const titleToSave = settings.catalogTitle || 'İsimsiz Katalog';

            if (selectedCatalogId) {
                const { error } = await supabase
                    .from('catalogs')
                    .update({ title: titleToSave, data: dataToSave, updated_at: new Date().toISOString() })
                    .eq('id', selectedCatalogId);
                if (error) {
                    if(error.code === '42P01') {
                        alert("Veritabanında 'catalogs' tablosu yok. Lütfen Supabase SQL editöründen tablonuzu oluşturun.");
                    } else throw error;
                } else {
                    alert('Katalog başarıyla güncellendi!');
                    loadCatalogs();
                }
            } else {
                const { data, error } = await supabase
                    .from('catalogs')
                    .insert([{ title: titleToSave, data: dataToSave }])
                    .select();
                if (error) {
                    if(error.code === '42P01') {
                        alert("Veritabanında 'catalogs' tablosu yok. Lütfen Supabase SQL editöründen tablonuzu oluşturun.");
                    } else throw error;
                } else if (data && data.length > 0) {
                    setSelectedCatalogId(data[0].id);
                    alert('Yeni katalog başarıyla kaydedildi!');
                    loadCatalogs();
                }
            }
        } catch (err) {
            console.error('Kaydetme hatası:', err);
            alert('Kaydedilemedi: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const fetchAndLoadCatalogParams = async (id) => {
        try {
            const { data, error } = await supabase.from('catalogs').select('*').eq('id', id).single();
            if (!error && data) {
                loadCatalogData(data);
            }
        } catch(err) {
            console.error(err);
        }
    };

    const loadCatalogData = (cat) => {
        if (!cat.data) return;
        setSelectedCatalogId(cat.id);
        if (cat.data.settings) setSettings(cat.data.settings);
        if (cat.data.companyInfo) setCompanyInfo(cat.data.companyInfo);
        if (cat.data.categories) setCategories(cat.data.categories);
        if (cat.data.products) setProducts(cat.data.products);
    };

    const handleNewCatalog = () => {
        setSelectedCatalogId(null);
        setSettings({
            logo: '/firmalogo.jpg',
            companyName: 'AYSALED AYDINLATMA',
            catalogTitle: 'Yeni Katalog',
            catalogSubtitle: '',
            defaultCurrency: 'TRY',
            template: 'modern'
        });
        setCategories([]);
        setProducts([]);
    };


    // --- HANDLERS ---
    const openMediaModal = (target) => {
        setMediaTarget(target);
        setMediaModalOpen(true);
    };

    const handleMediaSelect = (asset) => {
        const url = asset.publicUrl || asset.url;
        if (!url) return;

        if (mediaTarget.type === 'logo') {
            setSettings(prev => ({ ...prev, logo: url }));
        } else if (mediaTarget.type === 'product') {
            updateProduct(mediaTarget.id, mediaTarget.field, url);
        }
        setMediaModalOpen(false);
        setMediaTarget(null);
    };

    const updateCompanyInfo = (field, value) => {
        setCompanyInfo(prev => ({ ...prev, [field]: value }));
    };

    const addCategory = () => {
        if (newCatName && newCatName.trim() !== '') {
            setCategories(prev => [...prev, { id: Date.now(), name: newCatName.trim(), subtitle: newCatSubtitle.trim() }]);
            setNewCatName('');
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

    const exportPDF = async () => {
        if (!pdfReady || !window.html2pdf) {
            alert('PDF oluşturucu henüz yüklenmedi, lütfen birkaç saniye bekleyip tekrar deneyin.');
            return;
        }

        const element = document.getElementById('pdf-preview-container');
        if (!element) return;

        window.scrollTo(0, 0); // En tepeye kaydır
        setPdfLoading(true);

        setTimeout(async () => {
            try {
                const opt = {
                    margin: 0,
                    filename: `${settings.companyName.replace(/\s+/g, '-')}-Katalog.pdf`,
                    image: { type: 'jpeg', quality: 0.90 }, 
                    html2canvas: {
                        scale: 1.5,
                        useCORS: true,
                        logging: false,
                        scrollY: 0
                    },
                    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
                    pagebreak: { mode: ['css', 'legacy'], avoid: ['.page-break-avoid'] }
                };

                await window.html2pdf().set(opt).from(element).save();
            } catch (error) {
                console.error("PDF oluşturma hatası:", error);
                alert("PDF oluşturulurken bir hata oluştu. Lütfen konsolu kontrol edin.");
            } finally {
                setPdfLoading(false);
            }
        }, 300);
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
                <h3 className={`text-lg font-semibold mb-4 border-b pb-2 flex items-center ${isDark ? 'text-gray-100 border-gray-700' : 'text-gray-800 border-gray-200'}`}>
                    <Settings size={18} className="mr-2 text-blue-500" /> Katalog Ayarları & Şablon
                </h3>
                
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="col-span-2">
                            <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Kayıtlı Kataloglar</label>
                            <div className="flex gap-2">
                                <select 
                                    className="w-full p-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 outline-none"
                                    style={{ background: isDark ? '#1e293b' : '#fff', borderColor: isDark ? '#334155' : '#e2e8f0', color: isDark ? '#f8fafc' : '#000' }}
                                    value={selectedCatalogId || ''}
                                    onChange={(e) => {
                                        if (e.target.value) fetchAndLoadCatalogParams(e.target.value);
                                    }}
                                >
                                    <option value="">-- Katalog Seçin --</option>
                                    {savedCatalogs.map(c => (
                                        <option key={c.id} value={c.id}>{c.title} ({new Date(c.updated_at).toLocaleDateString()})</option>
                                    ))}
                                </select>
                                <button onClick={handleNewCatalog} className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm flex-shrink-0" title="Yeni Boş Katalog">
                                    Yeni
                                </button>
                                <button onClick={saveCatalog} disabled={saving} className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm flex items-center gap-1 flex-shrink-0">
                                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} 
                                    Kaydet
                                </button>
                            </div>
                        </div>

                        <div className="col-span-2 mt-2">
                            <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Katalog Şablonu</label>
                            <select
                                value={settings.template || 'modern'} 
                                onChange={(e) => setSettings({ ...settings, template: e.target.value })}
                                className="w-full p-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 outline-none"
                                style={{ background: isDark ? '#1e293b' : '#fff', borderColor: isDark ? '#334155' : '#e2e8f0', color: isDark ? '#f8fafc' : '#000' }}
                            >
                                {Object.values(TEMPLATES).map(tpl => (
                                    <option key={tpl.id} value={tpl.id}>{tpl.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Firma Logosu (Galeriden Seç)</label>
                        <div className="flex items-center space-x-4">
                            <div 
                                onClick={() => openMediaModal({ type: 'logo' })}
                                className={`h-24 w-full border-2 border-dashed rounded-lg flex items-center justify-center overflow-hidden relative group cursor-pointer transition ${isDark ? 'border-gray-600 bg-gray-800 hover:bg-gray-700' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'}`}
                            >
                                {settings.logo ? (
                                    <img src={settings.logo} alt="Logo" className="max-h-full max-w-full object-contain p-2" />
                                ) : (
                                    <div className="text-center">
                                        <FileImage className={`mx-auto mb-1 ${isDark ? 'text-gray-400' : 'text-gray-400'}`} size={24} />
                                        <span className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Logo Seçmek İçin Tıklayın</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Kısa Firma Adı</label>
                            <input
                                type="text" value={settings.companyName} onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                                className="w-full p-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 outline-none"
                                style={{ background: isDark ? '#1e293b' : '#fff', borderColor: isDark ? '#334155' : '#e2e8f0', color: isDark ? '#f8fafc' : '#000' }}
                            />
                        </div>
                        <div className="col-span-2">
                            <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Katalog Ana Başlığı</label>
                            <input
                                type="text" value={settings.catalogTitle} onChange={(e) => setSettings({ ...settings, catalogTitle: e.target.value })}
                                className="w-full p-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 outline-none"
                                style={{ background: isDark ? '#1e293b' : '#fff', borderColor: isDark ? '#334155' : '#e2e8f0', color: isDark ? '#f8fafc' : '#000' }}
                            />
                        </div>
                        <div className="col-span-2">
                            <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Katalog Alt Başlığı (Slogan vb.)</label>
                            <input
                                type="text" value={settings.catalogSubtitle} onChange={(e) => setSettings({ ...settings, catalogSubtitle: e.target.value })}
                                className="w-full p-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 outline-none"
                                style={{ background: isDark ? '#1e293b' : '#fff', borderColor: isDark ? '#334155' : '#e2e8f0', color: isDark ? '#f8fafc' : '#000' }}
                            />
                        </div>
                    </div>

                    <div>
                        <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Varsayılan Para Birimi</label>
                        <select
                            value={settings.defaultCurrency} onChange={(e) => setSettings({ ...settings, defaultCurrency: e.target.value })}
                            className="w-full p-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 outline-none"
                            style={{ background: isDark ? '#1e293b' : '#fff', borderColor: isDark ? '#334155' : '#e2e8f0', color: isDark ? '#f8fafc' : '#000' }}
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
                <h3 className={`text-lg font-semibold mb-4 border-b pb-2 flex items-center ${isDark ? 'text-gray-100 border-gray-700' : 'text-gray-800 border-gray-200'}`}>
                    <Building2 size={18} className="mr-2 text-blue-500" /> Kurumsal Bilgiler
                </h3>
                <p className={`text-xs mb-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Bu bilgiler kataloğun 2. sayfasında (Hakkımızda) ve arka kapakta gösterilir.</p>

                <div className="space-y-4">
                    <div>
                        <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Hakkımızda Yazısı</label>
                        <textarea
                            rows={4}
                            value={companyInfo.about} onChange={(e) => updateCompanyInfo('about', e.target.value)}
                            className="w-full p-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm outline-none"
                            style={{ background: isDark ? '#1e293b' : '#fff', borderColor: isDark ? '#334155' : '#e2e8f0', color: isDark ? '#f8fafc' : '#000' }}
                            placeholder="Firmanızı kısaca tanıtın..."
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Telefon</label>
                            <div className="flex">
                                <span className={`inline-flex items-center px-2 rounded-l-md border border-r-0 ${isDark ? 'border-gray-600 bg-gray-800 text-gray-400' : 'border-gray-300 bg-gray-50 text-gray-500'}`}><Phone size={14} /></span>
                                <input type="text" value={companyInfo.phone} onChange={(e) => updateCompanyInfo('phone', e.target.value)} 
                                    className="w-full p-2 border rounded-r-md text-sm outline-none" 
                                    style={{ background: isDark ? '#1e293b' : '#fff', borderColor: isDark ? '#334155' : '#e2e8f0', color: isDark ? '#f8fafc' : '#000' }} />
                            </div>
                        </div>
                        <div>
                            <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>E-Posta</label>
                            <div className="flex">
                                <span className={`inline-flex items-center px-2 rounded-l-md border border-r-0 ${isDark ? 'border-gray-600 bg-gray-800 text-gray-400' : 'border-gray-300 bg-gray-50 text-gray-500'}`}><Mail size={14} /></span>
                                <input type="email" value={companyInfo.email} onChange={(e) => updateCompanyInfo('email', e.target.value)} 
                                    className="w-full p-2 border rounded-r-md text-sm outline-none"
                                    style={{ background: isDark ? '#1e293b' : '#fff', borderColor: isDark ? '#334155' : '#e2e8f0', color: isDark ? '#f8fafc' : '#000' }} />
                            </div>
                        </div>
                        <div className="col-span-2">
                            <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Web Sitesi</label>
                            <div className="flex">
                                <span className={`inline-flex items-center px-2 rounded-l-md border border-r-0 ${isDark ? 'border-gray-600 bg-gray-800 text-gray-400' : 'border-gray-300 bg-gray-50 text-gray-500'}`}><Globe size={14} /></span>
                                <input type="text" value={companyInfo.website} onChange={(e) => updateCompanyInfo('website', e.target.value)} 
                                    className="w-full p-2 border rounded-r-md text-sm outline-none"
                                    style={{ background: isDark ? '#1e293b' : '#fff', borderColor: isDark ? '#334155' : '#e2e8f0', color: isDark ? '#f8fafc' : '#000' }} />
                            </div>
                        </div>
                        <div className="col-span-2">
                            <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Açık Adres</label>
                            <textarea
                                rows={2} value={companyInfo.address} onChange={(e) => updateCompanyInfo('address', e.target.value)}
                                className="w-full p-2 border rounded-md text-sm outline-none"
                                style={{ background: isDark ? '#1e293b' : '#fff', borderColor: isDark ? '#334155' : '#e2e8f0', color: isDark ? '#f8fafc' : '#000' }}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderCategoriesTab = () => (
        <div className="space-y-4 animate-fadeIn">
            <div className={`flex justify-between items-center border-b pb-2 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                <h3 className={`text-lg font-semibold flex items-center ${isDark ? 'text-gray-100' : 'text-gray-800'}`}>
                    <List size={18} className="mr-2 text-blue-500" /> Kategoriler
                </h3>
            </div>
            <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Bu kategoriler "İçindekiler" bölümünde otomatik listelenecektir.</p>

            {/* Kategori Ekleme Formu */}
            <div className={`p-3 border rounded-md shadow-sm ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                <div className="space-y-2 mb-3">
                    <input 
                        type="text" placeholder="Kategori Adı (Örn: Trimless LED)" 
                        value={newCatName} onChange={e => setNewCatName(e.target.value)}
                        className={`w-full p-2 border rounded text-sm outline-none focus:border-blue-500 ${isDark ? 'bg-gray-900 border-gray-600 text-white' : 'bg-gray-50 border-gray-300'}`}
                    />
                    <textarea 
                        placeholder="Kapak Sloganı (Opsiyonel. Satır atlayabilirsiniz.)" 
                        value={newCatSubtitle} onChange={e => setNewCatSubtitle(e.target.value)} rows={3}
                        className={`w-full p-2 border rounded text-sm outline-none focus:border-blue-500 ${isDark ? 'bg-gray-900 border-gray-600 text-white' : 'bg-gray-50 border-gray-300'}`}
                    />
                </div>
                <button
                    onClick={addCategory} disabled={!newCatName.trim()}
                    className="w-full flex justify-center items-center px-3 py-2 bg-blue-600 text-white text-sm font-semibold rounded hover:bg-blue-700 disabled:opacity-50 transition shadow-sm"
                >
                    <Plus size={16} className="mr-1" /> Kategori Ekle
                </button>
            </div>

            <div className="space-y-2 mt-4">
                {categories.map(cat => (
                    <div key={cat.id} className={`flex justify-between items-center p-3 border rounded-md shadow-sm group ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                        <div className="flex flex-col">
                            <span className={`font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{cat.name}</span>
                            {cat.subtitle && <span className={`text-[10px] whitespace-pre-line ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{cat.subtitle}</span>}
                        </div>
                        <button onClick={() => deleteCategory(cat.id)} className="text-gray-400 hover:text-red-500 transition p-1 cursor-pointer z-10 flex-shrink-0 ml-2">
                            <Trash2 size={16} />
                        </button>
                    </div>
                ))}
                {categories.length === 0 && (
                    <div className={`text-center py-8 border border-dashed rounded-md ${isDark ? 'border-gray-600 bg-gray-800/50' : 'border-gray-300 bg-white'}`}>
                        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Kategori bulunamadı.</p>
                    </div>
                )}
            </div>
        </div>
    );

    const renderProductsTab = () => (
        <div className="space-y-6 animate-fadeIn">
            <div className={`flex justify-between items-center border-b pb-2 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                <h3 className={`text-lg font-semibold flex items-center ${isDark ? 'text-gray-100' : 'text-gray-800'}`}>
                    <Package size={18} className="mr-2 text-blue-500" /> Ürün Yönetimi
                </h3>
                <button
                    onClick={addProduct}
                    className="flex items-center px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition shadow-sm"
                >
                    <Plus size={16} className="mr-1" /> Yeni Ürün
                </button>
            </div>

            <div className="space-y-6 flex flex-col items-stretch w-full overflow-hidden">
                {products.map((product) => (
                    <div key={product.id} className={`border rounded-xl p-4 shadow-sm relative group transition hover:border-blue-500/50 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                        <button
                            onClick={() => deleteProduct(product.id)}
                            className={`absolute -top-3 -right-3 border text-gray-400 hover:text-red-500 hover:border-red-200 rounded-full p-1.5 shadow-sm transition z-10 opacity-0 group-hover:opacity-100 cursor-pointer ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200'}`}
                            title="Ürünü Sil"
                        >
                            <Trash2 size={16} />
                        </button>

                        <div className="grid grid-cols-1 gap-5">
                            <div className="space-y-4 max-w-full">
                                <div>
                                    <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Bağlı Kategori</label>
                                    <select
                                        value={product.categoryId}
                                        onChange={(e) => updateProduct(product.id, 'categoryId', Number(e.target.value))}
                                        className="w-full p-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none transition"
                                        style={{ background: isDark ? '#1e293b' : '#f9fafb', borderColor: isDark ? '#334155' : '#e2e8f0', color: isDark ? '#f8fafc' : '#000' }}
                                    >
                                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>

                                <div className="flex gap-3">
                                    <div className="w-1/3">
                                        <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Ürün Kodu</label>
                                        <input
                                            type="text" value={product.code} placeholder="Örn: AYS-01"
                                            onChange={(e) => updateProduct(product.id, 'code', e.target.value)}
                                            className="w-full p-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none min-w-0"
                                            style={{ background: isDark ? '#1e293b' : '#fff', borderColor: isDark ? '#334155' : '#e2e8f0', color: isDark ? '#f8fafc' : '#000' }}
                                        />
                                    </div>
                                    <div className="w-2/3">
                                        <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Ürün Adı</label>
                                        <input
                                            type="text" value={product.name} placeholder="Ürün adı..."
                                            onChange={(e) => updateProduct(product.id, 'name', e.target.value)}
                                            className="w-full p-2 border rounded-md text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none min-w-0"
                                            style={{ background: isDark ? '#1e293b' : '#fff', borderColor: isDark ? '#334155' : '#e2e8f0', color: isDark ? '#f8fafc' : '#000' }}
                                        />
                                    </div>
                                </div>

                                <div className={`flex gap-3 items-end p-2 rounded-md border ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-100'}`}>
                                    <div className="flex-1">
                                        <label className={`block text-[10px] uppercase font-bold mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Fiyat Belirle</label>
                                        <div className="flex shadow-sm">
                                            <input
                                                type="number" value={product.price} placeholder="0.00"
                                                onChange={(e) => updateProduct(product.id, 'price', e.target.value)}
                                                className="w-full min-w-[60px] p-1.5 border rounded-l-md text-sm focus:z-10 focus:ring-1 focus:ring-blue-500 outline-none"
                                                style={{ background: isDark ? '#1e293b' : '#fff', borderColor: isDark ? '#334155' : '#e2e8f0', color: isDark ? '#f8fafc' : '#000' }}
                                            />
                                            <select
                                                value={product.currency}
                                                onChange={(e) => updateProduct(product.id, 'currency', e.target.value)}
                                                className="p-1.5 border border-l-0 rounded-r-md text-sm"
                                                style={{ background: isDark ? '#0f172a' : '#fff', borderColor: isDark ? '#334155' : '#e2e8f0', color: isDark ? '#f8fafc' : '#000' }}
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
                                                className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                                            />
                                            <span className={`font-medium text-xs ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Fiyatı Göster</span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4 max-w-full">
                                <div>
                                    <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Görseller (Galeriden Seç)</label>
                                    <div className="flex items-center space-x-2">
                                        <div 
                                            onClick={() => openMediaModal({ type: 'product', id: product.id, field: 'image' })}
                                            className={`h-24 flex-1 border-2 border-dashed rounded-lg flex flex-col items-center justify-center relative overflow-hidden group hover:border-blue-400 transition cursor-pointer ${isDark ? 'border-gray-600 bg-gray-900/50' : 'border-gray-300 bg-gray-50'}`}
                                        >
                                            {product.image ? (
                                                <img src={product.image} alt="Product" className="object-cover w-full h-full p-1" />
                                            ) : (
                                                <FileImage size={20} className="text-gray-400 group-hover:text-blue-400 transition mb-1" />
                                            )}
                                            <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[9px] text-center py-0.5 font-medium tracking-wider">
                                                ANA GÖRSEL
                                            </div>
                                        </div>

                                        <div 
                                            onClick={() => openMediaModal({ type: 'product', id: product.id, field: 'techImage' })}
                                            className={`h-24 flex-1 border-2 border-dashed rounded-lg flex flex-col items-center justify-center relative overflow-hidden group hover:border-blue-400 transition cursor-pointer ${isDark ? 'border-gray-600 bg-gray-900/50' : 'border-gray-300 bg-gray-50'}`}
                                        >
                                            {product.techImage ? (
                                                <img src={product.techImage} alt="Tech" className="object-cover w-full h-full p-1" />
                                            ) : (
                                                <FileImage size={20} className="text-gray-400 group-hover:text-blue-400 transition mb-1" />
                                            )}
                                            <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[9px] text-center py-0.5 font-medium tracking-wider">
                                                TEKNİK ÇİZİM
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="w-full">
                                    <div className="flex justify-between items-center mb-2">
                                        <label className={`block text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Teknik Özellik Tablosu</label>
                                        <button onClick={() => addFeature(product.id)} className="text-[10px] uppercase font-bold bg-blue-500/20 text-blue-500 px-2 py-1 rounded hover:bg-blue-500/30 transition">
                                            + Satır Ekle
                                        </button>
                                    </div>
                                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                                        {product.features && product.features.map((feat, fIndex) => (
                                            <div key={fIndex} className="flex gap-1.5 items-center">
                                                <input
                                                    type="text" value={feat.key} placeholder="Özellik"
                                                    onChange={(e) => updateFeature(product.id, fIndex, 'key', e.target.value)}
                                                    className="w-2/5 min-w-0 p-1.5 border rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                                                    style={{ background: isDark ? '#1e293b' : '#f9fafb', borderColor: isDark ? '#334155' : '#e2e8f0', color: isDark ? '#f8fafc' : '#000' }}
                                                />
                                                <input
                                                    type="text" value={feat.value} placeholder="Değer"
                                                    onChange={(e) => updateFeature(product.id, fIndex, 'value', e.target.value)}
                                                    className="flex-1 min-w-0 p-1.5 border rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                                                    style={{ background: isDark ? '#1e293b' : '#fff', borderColor: isDark ? '#334155' : '#e2e8f0', color: isDark ? '#f8fafc' : '#000' }}
                                                />
                                                <button
                                                    onClick={() => removeFeature(product.id, fIndex)}
                                                    className="p-1.5 text-gray-400 hover:text-red-500 rounded transition cursor-pointer"
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
                    <div className={`text-center py-12 border rounded-xl shadow-sm ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                        <Package className="mx-auto text-gray-400 mb-3" size={40} />
                        <p className={`font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>Kataloğunuzda henüz ürün yok.</p>
                        <p className={`text-sm mt-1 mb-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Müşterilerinize sunmak için ilk ürününüzü ekleyin.</p>
                        <button onClick={addProduct} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md shadow-sm hover:bg-blue-700">
                            Ürün Ekle
                        </button>
                    </div>
                )}
            </div>
        </div>
    );

    const tpl = TEMPLATES[settings.template] || TEMPLATES.modern;
    const c = tpl.colors;

    return (
        <div className="h-[91vh] w-full flex flex-col lg:flex-row font-sans overflow-hidden" style={{ background: isDark ? '#0f172a' : '#f8fafc' }}>
            
            {/* Medya Modal */}
            <MediaPickerModal 
                isOpen={mediaModalOpen}
                onClose={() => { setMediaModalOpen(false); setMediaTarget(null); }}
                onSelect={handleMediaSelect}
            />

            {/* Özel CSS ve PDF Baskı Ayarları */}
            <style dangerouslySetInnerHTML={{
                __html: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
        
        #pdf-preview-container {
          font-family: 'Inter', sans-serif;
          width: 210mm;
          background-color: #ffffff;
        }
        
        .pdf-page {
          width: 210mm;
          height: 296mm; 
          background: #ffffff;
          position: relative;
          overflow: hidden;
          box-sizing: border-box;
          page-break-after: always;
          break-after: page;
        }

        .pdf-page-content {
          width: 210mm;
          min-height: 296mm; 
          background: #ffffff;
          position: relative;
          box-sizing: border-box;
          padding: 15mm;
        }

        @media screen {
          .screen-divider { border-bottom: 2px dashed #cbd5e1; }
        }

        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none; }
          .page-break-avoid { page-break-inside: avoid; break-inside: avoid; }
          .screen-divider { border-bottom: none; }
        }
        
        /* Custom Scrollbar */
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: ${isDark ? '#1e293b' : '#f1f1f1'}; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: ${isDark ? '#475569' : '#c1c1c1'}; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #888; }
        
        /* Loader Overlay (PDF Download) */
        .pdf-loader-overlay {
            position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 9999;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            color: white; backdrop-filter: blur(4px);
        }

        /* Fix for html2canvas oklab parsing bug */
        #pdf-preview-container * {
            border-color: #e2e8f0;
        }
      `}} />

            {/* --- SOL PANEL (KONTROLLER) --- */}
            <div className={`w-full lg:w-[450px] border-r flex flex-col h-[50vh] lg:h-full z-20 flex-shrink-0 ${isDark ? 'bg-[#0f172a] border-[#1e293b]' : 'bg-white border-gray-200 shadow-[4px_0_24px_rgba(0,0,0,0.05)]'}`}>
                <div className={`p-4 text-white ${isDark ? 'bg-gradient-to-r from-gray-800 to-gray-900 border-b border-gray-700' : 'bg-gradient-to-r from-blue-700 to-blue-600'}`}>
                    <h1 className="text-xl font-bold flex items-center">
                        <AlignLeft className="mr-2 opacity-80" /> Katalog Yönetimi
                    </h1>
                </div>

                {/* Sekmeler */}
                <div className={`flex border-b text-xs font-semibold uppercase tracking-wider ${isDark ? 'bg-[#0f172a] border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
                    <button
                        onClick={() => setActiveTab('settings')}
                        className={`flex-1 py-3 flex justify-center items-center transition ${activeTab === 'settings' ? (isDark ? 'border-b-2 border-blue-500 text-blue-400 bg-gray-800' : 'border-b-2 border-blue-600 text-blue-700 bg-white') : (isDark ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100')}`}
                    >
                        Genel
                    </button>
                    <button
                        onClick={() => setActiveTab('company')}
                        className={`flex-1 py-3 flex justify-center items-center transition ${activeTab === 'company' ? (isDark ? 'border-b-2 border-blue-500 text-blue-400 bg-gray-800' : 'border-b-2 border-blue-600 text-blue-700 bg-white') : (isDark ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100')}`}
                    >
                        Firma
                    </button>
                    <button
                        onClick={() => setActiveTab('categories')}
                        className={`flex-1 py-3 flex justify-center items-center transition ${activeTab === 'categories' ? (isDark ? 'border-b-2 border-blue-500 text-blue-400 bg-gray-800' : 'border-b-2 border-blue-600 text-blue-700 bg-white') : (isDark ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100')}`}
                    >
                        Kat.
                    </button>
                    <button
                        onClick={() => setActiveTab('products')}
                        className={`flex-1 py-3 flex justify-center items-center transition ${activeTab === 'products' ? (isDark ? 'border-b-2 border-blue-500 text-blue-400 bg-gray-800' : 'border-b-2 border-blue-600 text-blue-700 bg-white') : (isDark ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100')}`}
                    >
                        Ürünler
                    </button>
                </div>

                {/* Sekme İçerikleri */}
                <div className={`flex-1 overflow-y-auto p-4 custom-scrollbar ${isDark ? 'bg-[#0b1120]' : 'bg-gray-50/50'}`}>
                    {activeTab === 'settings' && renderSettingsTab()}
                    {activeTab === 'company' && renderCompanyTab()}
                    {activeTab === 'categories' && renderCategoriesTab()}
                    {activeTab === 'products' && renderProductsTab()}
                </div>

                {/* Dışa Aktar Butonu */}
                <div className={`p-4 border-t ${isDark ? 'bg-[#0f172a] border-gray-800' : 'bg-white shadow-[0_-4px_10px_rgba(0,0,0,0.02)]'}`}>
                    <button
                        onClick={exportPDF}
                        disabled={pdfLoading}
                        className={`w-full py-3 text-white font-bold rounded-lg flex justify-center items-center shadow-lg transition transform hover:-translate-y-0.5 ${isDark ? 'bg-blue-600 hover:bg-blue-500' : 'bg-gray-900 hover:bg-black'}`}
                    >
                        {pdfLoading ? <Loader2 className="mr-2 animate-spin" size={20} /> : <Download className="mr-2" size={20} />} 
                        {pdfLoading ? 'Hızlı PDF Hazırlanıyor...' : 'PDF İndir'}
                    </button>
                    <p className={`text-center text-[10px] mt-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>İndirmeden önce sağ taraftaki önizlemeyi kontrol edin.</p>
                </div>
            </div>

            {pdfLoading && (
                <div className="pdf-loader-overlay">
                    <Loader2 size={48} className="animate-spin text-blue-500 mb-4" />
                    <h2 className="text-2xl font-bold">PDF Hazırlanıyor...</h2>
                    <p className="text-gray-300 mt-2">Görsellerin boyutuna ve sayfaya göre işlem biraz sürebilir, lütfen sayfayı kapatmayın.</p>
                </div>
            )}

            {/* --- SAĞ PANEL (CANLI ÖNİZLEME) - TAILWIND RENKLİ SINIFLARI KULLANILMAMALI --- */}
            <div className={`flex-1 h-[50vh] lg:h-full overflow-y-auto p-4 lg:p-10 flex flex-col items-center custom-scrollbar ${isDark ? 'bg-black/50' : 'bg-gray-500'}`}>

                <div className="shadow-[0_20px_50px_rgba(0,0,0,0.3)] bg-white text-black" style={{ backgroundColor: '#ffffff', color: '#000000' }}>
                    <div id="pdf-preview-container" className="flex flex-col relative" style={{ backgroundColor: '#ffffff' }}>

                        {/* ================= 1. KAPAK SAYFASI (Front Cover) ================= */}
                        <div className="pdf-page flex flex-col relative screen-divider" style={{ backgroundColor: c.bgPrimary }}>
                            
                            {/* Üst Dekoratif Alan */}
                            {settings.template !== 'classic' && (
                                <div className="absolute top-0 left-0 w-full h-[300px] z-0 pointer-events-none">
                                    <svg preserveAspectRatio="none" viewBox="0 0 100 100" className="w-full h-full" style={{ display: 'block' }}>
                                        <polygon fill={c.accent} points="0,0 100,0 100,100 0,60" />
                                    </svg>
                                </div>
                            )}

                            <div className="flex-1 flex flex-col justify-center items-center px-[64px] text-center z-10 pt-[64px]">
                                {/* Logo Alanı */}
                                <div className="p-[32px] rounded-[16px] mb-[48px] min-h-[140px] w-4/5 flex items-center justify-center transform transition duration-500 shadow-2xl hover:scale-105" style={{ backgroundColor: c.bgSecondary }}>
                                    {settings.logo ? (
                                        <img src={settings.logo} alt="Firma Logosu" className="max-h-[96px] w-full object-contain mix-blend-multiply" />
                                    ) : (
                                        <h1 className="text-4xl font-black tracking-wider uppercase m-0" style={{ color: c.textMain }}>
                                            {settings.companyName}
                                        </h1>
                                    )}
                                </div>

                                {/* Başlık Alanı */}
                                <h1 className="text-6xl font-black leading-tight tracking-tight mb-[16px] drop-shadow-lg m-0" style={{ color: c.textInverse }}>
                                    {settings.catalogTitle.split(' ').map((word, i) => (
                                        <React.Fragment key={i}>
                                            {i === 0 ? <span style={{ color: c.accent }}>{word}</span> : word}{' '}
                                        </React.Fragment>
                                    ))}
                                </h1>

                                <div className="w-[96px] h-[6px] mb-[24px] rounded-full" style={{ backgroundColor: c.accent }}></div>

                                <p className="tracking-[0.25em] uppercase text-sm font-semibold m-0" style={{ color: c.coverTextBody }}>
                                    {settings.catalogSubtitle}
                                </p>
                            </div>

                            {/* Alt Footer Bölümü */}
                            <div className="h-[128px] flex flex-col items-center justify-center pb-[16px] z-10 relative border-t" style={{ backgroundColor: c.bgDark, borderColor: c.border }}>
                                <p className="tracking-widest text-xs uppercase font-bold mb-[4px] m-0" style={{ color: c.accent }}>{settings.companyName}</p>
                                <p className="text-[10px] uppercase m-0" style={{ color: c.coverTextBody }}>{new Date().getFullYear()} Koleksiyonu</p>
                            </div>
                        </div>

                        {/* ================= 2. İÇİNDEKİLER VE HAKKIMIZDA (Index Page) ================= */}
                        <div className="pdf-page flex flex-col screen-divider" style={{ backgroundColor: '#ffffff', padding: '15mm' }}>
                            <div className="flex justify-between items-end border-b-[2px] pb-[16px] mb-[40px]" style={{ borderColor: c.textMain }}>
                                <h2 className="text-4xl font-black tracking-tight m-0" style={{ color: c.textMain }}>HAKKIMIZDA <span style={{ color: c.accent }}>&</span> İÇİNDEKİLER</h2>
                                {settings.logo && <img src={settings.logo} className="h-[40px] object-contain" alt="Logo mini" />}
                            </div>

                            <div className="flex gap-[48px] flex-1">
                                <div className="w-1/2 flex flex-col">
                                    <h3 className="text-xl font-bold mb-[24px] flex items-center m-0" style={{ color: c.textMain }}>
                                        <span className="w-[32px] h-[4px] mr-[12px]" style={{ backgroundColor: c.accent }}></span> Biz Kimiz?
                                    </h3>
                                    <p className="leading-relaxed text-sm text-justify mb-[40px] m-0" style={{ color: '#475569' }}>
                                        {companyInfo.about}
                                    </p>

                                    <div className="mt-auto p-[24px] rounded-[12px] border" style={{ backgroundColor: '#f8fafc', borderColor: '#f1f5f9' }}>
                                        <h4 className="text-sm font-bold mb-[16px] uppercase tracking-wider m-0" style={{ color: c.textMain }}>İletişim</h4>
                                        <div className="space-y-[12px] text-sm" style={{ color: '#475569' }}>
                                            <div className="flex items-center"><Phone size={16} className="mr-[12px]" style={{ color: c.accent }} /> {companyInfo.phone}</div>
                                            <div className="flex items-center"><Mail size={16} className="mr-[12px]" style={{ color: c.accent }} /> {companyInfo.email}</div>
                                            <div className="flex items-center"><Globe size={16} className="mr-[12px]" style={{ color: c.accent }} /> {companyInfo.website}</div>
                                            <div className="flex items-start mt-[8px] pt-[8px] border-t" style={{ borderColor: '#e2e8f0' }}>
                                                <MapPin size={16} className="mr-[12px] mt-[4px] flex-shrink-0" style={{ color: c.accent }} />
                                                <span className="leading-snug">{companyInfo.address}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="w-1/2">
                                    <h3 className="text-xl font-bold mb-[24px] flex items-center m-0" style={{ color: c.textMain }}>
                                        <span className="w-[32px] h-[4px] mr-[12px]" style={{ backgroundColor: c.accent }}></span> Kategoriler
                                    </h3>
                                    <div className="space-y-[16px]">
                                        {categories.map((cat, index) => (
                                            <div key={cat.id} className="flex items-center text-sm">
                                                <span className="font-bold text-lg w-[32px]" style={{ color: c.accent }}>{(index + 1).toString().padStart(2, '0')}</span>
                                                <span className="font-semibold flex-1 uppercase tracking-wide" style={{ color: c.textMain }}>{cat.name}</span>
                                                <div className="flex-1 border-b border-dotted mx-[12px] relative top-[8px]" style={{ borderColor: '#cbd5e1' }}></div>
                                                <span className="font-medium text-xs" style={{ color: '#94a3b8' }}>Bölüm</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="text-center text-[10px] uppercase tracking-widest mt-[32px] border-t pt-[16px] m-0" style={{ color: '#94a3b8', borderColor: '#f1f5f9' }}>Sayfa 02</div>
                        </div>

                        {/* ================= 3. İÇERİK SAYFALARI ================= */}
                        <div className="pdf-content-wrapper flex flex-col">
                            {categories.map((category, catIndex) => {
                                const categoryProducts = products.filter(p => p.categoryId === category.id);
                                if (categoryProducts.length === 0) return null;

                                return (
                                    <React.Fragment key={category.id}>
                                        {/* KATEGORİ KAPAK SAYFASI */}
                                        <div className="pdf-page screen-divider flex flex-col justify-center items-center relative overflow-hidden" style={{ minHeight: '296mm' }}>
                                            {/* Arkaplan Dalgası */}
                                            <div className="absolute inset-0 z-0 bg-cover bg-center" style={{ backgroundImage: 'url(/wave_bg.png)', filter: 'brightness(0.95) contrast(1.1)' }}></div>
                                            
                                            {/* Gradien Overlay */}
                                            <div className="absolute inset-0 z-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>

                                            <div className="relative z-10 w-full px-[64px]">
                                                {/* Kategori Başlığı Renk Geçişli */}
                                                <h1 className="text-[4rem] font-black uppercase text-white drop-shadow-2xl leading-tight mb-[32px] text-left w-4/5 font-sans">
                                                    {category.name.split(' ').map((word, i) => (
                                                        <span key={i} className={i % 2 === 0 ? "text-white block" : "text-gray-300 block font-bold"}>
                                                            {word}
                                                        </span>
                                                    ))}
                                                </h1>
                                                
                                                {/* Slogan veya Açıklama (Dekoratif Kare İçinde) */}
                                                {category.subtitle && (
                                                    <div className="mt-[32px] p-[32px] border-l-[3px] border-b-[3px] border-white inline-block">
                                                        <h2 className="text-[2.5rem] font-light text-white leading-tight font-sans tracking-wide drop-shadow-lg whitespace-pre-line">
                                                            {category.subtitle}
                                                        </h2>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* ÜRÜN SAYFALARI (KATEGORİNİN ÜRÜNLERİ) */}
                                        {Array.from({ length: Math.ceil(categoryProducts.length / 3) }).map((_, pageIdx) => {
                                            const group = categoryProducts.slice(pageIdx * 3, pageIdx * 3 + 3);
                                            return (
                                                <div key={`page-${pageIdx}`} className="pdf-page flex flex-col screen-divider relative" style={{ backgroundColor: '#ffffff', minHeight: '296mm', padding: '15mm' }}>
                                                    {group.map((product, pIdx) => (
                                                        <div key={product.id} className="flex-1 flex flex-col w-full relative mb-[16mm] last:mb-0" style={{ maxHeight: '82mm' }}>
                                                            {/* Üstteki Ürün İsmi ve Kod */}
                                                            <div className="w-full flex justify-between items-start mb-[16px] pb-2" style={{ borderBottom: '2px solid #f1f5f9' }}>
                                                                <h3 className="text-xl font-black uppercase tracking-wide" style={{ color: '#1e293b' }}>
                                                                    {product.name} <span className="font-semibold ml-2 capitalize text-sm" style={{ color: '#94a3b8' }}>/ {category.name}</span>
                                                                </h3>
                                                                <div className="flex items-center gap-[12px]">
                                                                    <div className="text-[9px] font-bold flex flex-col items-end leading-[1.2]" style={{ color: '#1e293b' }}>
                                                                        <span>ÜRÜN KODU</span>
                                                                        <span className="font-normal" style={{ color: '#94a3b8' }}>CODE</span>
                                                                    </div>
                                                                    <div className="text-3xl font-black tracking-tighter leading-none" style={{ color: '#e11d48', textShadow: '1px 1px 2px rgba(225,29,72,0.1)' }}>
                                                                        {product.code || '-'}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Orta Layout (Sol Resim, Orta Özellikler, Sağ Teknik Çizim) */}
                                                            <div className="flex gap-[32px] flex-1 min-h-[0px]">
                                                                {/* Sol: Tamamı Resim (Arkaplanda yuvarlak YOK) */}
                                                                <div className="w-1/3 flex flex-col justify-center items-center relative h-full">
                                                                    {product.image ? (
                                                                        <img src={product.image} className="max-w-[120%] max-h-[100%] object-contain z-10 relative" alt={product.name} style={{ filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.1))' }} />
                                                                    ) : (
                                                                        <div className="z-10 relative" style={{ color: '#cbd5e1' }}><FileImage size={48}/></div>
                                                                    )}
                                                                </div>

                                                                {/* Orta: Özellikler (Grid) */}
                                                                <div className="w-1/3 flex flex-col justify-center h-full">
                                                                    <div className="grid grid-cols-1 gap-y-[12px]">
                                                                        {product.features?.filter(f => f.key || f.value).slice(0,4).map((feat, i) => {
                                                                            const isLength = feat.key.toLowerCase().includes('uzun') || feat.key.toLowerCase().includes('boy');
                                                                            const isPack = feat.key.toLowerCase().includes('koli') || feat.key.toLowerCase().includes('adet');
                                                                            const isVolt = feat.key.toLowerCase().includes('volt') || feat.key.toLowerCase().includes('güç');

                                                                            const iconContent = isLength ? (
                                                                                <svg style={{ width: '20px', height: '20px', margin: '0 auto' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M8 6l4-4 4 4M8 18l4 4 4-4"/></svg>
                                                                            ) : isPack ? (
                                                                                <Package size={20} style={{ margin: '0 auto' }} />
                                                                            ) : isVolt ? (
                                                                                <Zap size={20} style={{ margin: '0 auto' }} />
                                                                            ) : (
                                                                                <Settings size={20} style={{ margin: '0 auto' }} />
                                                                            );

                                                                            return (
                                                                                <div key={i} className="flex gap-[12px] items-center">
                                                                                    <div className="w-[36px] h-[36px] rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#000000', color: '#ffffff' }}>
                                                                                        {iconContent}
                                                                                    </div>
                                                                                    <div className="text-[11px] leading-tight flex-1">
                                                                                        <div className="font-semibold" style={{ color: '#1e293b' }}>{feat.key}</div>
                                                                                        <div className="font-light whitespace-normal" style={{ color: '#64748b' }}>{feat.value}</div>
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                        {/* Fiyat bilgisi varsa */}
                                                                        {product.showPrice && product.price && (
                                                                            <div className="flex gap-[12px] items-center">
                                                                                <div className="w-[36px] h-[36px] rounded-full flex items-center justify-center font-bold text-[14px] flex-shrink-0" style={{ backgroundColor: '#2563eb', color: '#ffffff' }}>
                                                                                    {getCurrencySymbol(product.currency)}
                                                                                </div>
                                                                                <div className="text-[11px] leading-tight flex-1">
                                                                                    <div className="font-bold tracking-widest" style={{ color: '#2563eb' }}>FİYAT</div>
                                                                                    <div className="font-black text-sm" style={{ color: '#1e293b' }}>{product.price}</div>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                {/* Sağ: Teknik Çizim */}
                                                                <div className="w-1/3 flex pl-[16px] items-center justify-center h-full relative" style={{ borderLeft: '1px solid #f1f5f9' }}>
                                                                    {product.techImage ? (
                                                                        <img src={product.techImage} className="w-[95%] max-h-full object-contain mix-blend-multiply opacity-95" alt={`${product.name} Teknik`} />
                                                                    ) : (
                                                                        <div className="text-[10px] transform -rotate-90 opacity-50 tracking-widest uppercase" style={{ color: '#cbd5e1' }}>Teknik Çizim Yok</div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            );
                                        })}
                                    </React.Fragment>
                                );
                            })}

                            {products.length === 0 && (
                                <div className="pdf-page-content screen-divider" style={{ backgroundColor: '#ffffff', padding: '15mm' }}>
                                    <div className="text-center py-[128px] border-[2px] border-dashed rounded-[12px] mx-[40px] border-gray-300">
                                        <p className="text-2xl font-bold mb-[8px] text-gray-500">Katalog İçeriği Boş</p>
                                        <p className="text-sm text-gray-400">Yönetim panelinden kategoriler ve ürünler eklediğinizde burada listelenecektir.</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="html2pdf__page-break"></div>

                        {/* ================= 4. ARKA KAPAK (Back Cover) ================= */}
                        <div className="pdf-page flex flex-col" style={{ backgroundColor: c.bgPrimary }}>
                            <div className="flex-1 flex flex-col justify-center items-center px-[64px] text-center">

                                <div className="w-[64px] h-[4px] mb-[32px] rounded-full" style={{ backgroundColor: c.accent }}></div>

                                <h2 className="text-4xl font-black mb-[16px] uppercase tracking-wider m-0" style={{ color: c.textInverse }}>Bize Ulaşın</h2>
                                <p className="text-sm mb-[48px] max-w-md mx-auto font-light m-0" style={{ color: c.coverTextBody }}>
                                    Projeleriniz için özel aydınlatma çözümleri, fiyat teklifleri ve teknik destek almak için uzman ekibimizle iletişime geçin.
                                </p>

                                <div className="p-[32px] rounded-[16px] border w-full max-w-lg" style={{ backgroundColor: c.bgSecondary, borderColor: c.border }}>
                                    <div className="space-y-[24px] text-left">
                                        <div className="flex items-center">
                                            <div className="w-[40px] h-[40px] rounded-full flex items-center justify-center mr-[16px] flex-shrink-0" style={{ backgroundColor: c.accent }}>
                                                <Phone size={20} style={{ color: '#ffffff' }} />
                                            </div>
                                            <div>
                                                <p className="text-xs uppercase tracking-wider font-bold mb-[2px] m-0" style={{ color: c.textLight }}>Müşteri Hizmetleri</p>
                                                <p className="font-semibold text-lg m-0" style={{ color: c.textMain }}>{companyInfo.phone}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center">
                                            <div className="w-[40px] h-[40px] rounded-full flex items-center justify-center mr-[16px] flex-shrink-0" style={{ backgroundColor: c.accent }}>
                                                <Mail size={20} style={{ color: '#ffffff' }} />
                                            </div>
                                            <div>
                                                <p className="text-xs uppercase tracking-wider font-bold mb-[2px] m-0" style={{ color: c.textLight }}>E-Posta</p>
                                                <p className="font-semibold text-lg m-0" style={{ color: c.textMain }}>{companyInfo.email}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center">
                                            <div className="w-[40px] h-[40px] rounded-full flex items-center justify-center mr-[16px] flex-shrink-0" style={{ backgroundColor: c.accent }}>
                                                <MapPin size={20} style={{ color: '#ffffff' }} />
                                            </div>
                                            <div>
                                                <p className="text-xs uppercase tracking-wider font-bold mb-[2px] m-0" style={{ color: c.textLight }}>Merkez Ofis & Fabrika</p>
                                                <p className="font-semibold text-sm leading-snug m-0" style={{ color: c.textMain }}>{companyInfo.address}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="h-[160px] flex flex-col items-center justify-center relative overflow-hidden border-t" style={{ backgroundColor: c.bgDark, borderColor: c.border }}>
                                {settings.template !== 'classic' && settings.template !== 'minimal' && <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" style={{ display: 'block' }}></div>}
                                {settings.logo ? (
                                    <img src={settings.logo} className="h-[48px] object-contain mb-[12px] z-10" style={settings.template!=='classic' && settings.template!=='minimal' ? { filter: 'brightness(0) invert(1)', opacity: 0.7 } : {}} alt="Logo" />
                                ) : (
                                    <h3 className="text-xl font-bold tracking-widest z-10 m-0" style={{ color: c.textLight }}>{settings.companyName}</h3>
                                )}
                                <p className="text-xs tracking-widest font-bold z-10 m-0" style={{ color: c.accent }}>{companyInfo.website}</p>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}