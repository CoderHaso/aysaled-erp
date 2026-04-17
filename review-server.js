import http from 'http';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://qtlcsylzenqlpkqojkon.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_mdE70dvCDgBUria3WNA5Wg_mkzPmN6y';
const supabase = createClient(supabaseUrl, supabaseKey);

const PORT = 3019;

const htmlContent = `
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cari Veri Karşılaştırma Ekranı</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 20px; }
        .header { text-align: center; margin-bottom: 20px; }
        .controls { display: flex; justify-content: center; gap: 15px; margin-bottom: 30px; }
        button { background: #3b82f6; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; cursor: pointer; transition: 0.2s; }
        button:hover { background: #2563eb; }
        button:disabled { background: #475569; cursor: not-allowed; }
        .btn-save { background: #10b981; margin-top: 15px; width: 100%; padding: 12px; font-size: 1.1rem; }
        .btn-save:hover { background: #059669; }
        .container { display: flex; gap: 20px; height: calc(100vh - 180px); }
        .panel { flex: 1; background: #1e293b; border-radius: 16px; padding: 20px; overflow-y: auto; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border: 1px solid #334155; }
        .panel-title { font-size: 1.25rem; font-weight: bold; margin-top: 0; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #334155; color: #93c5fd; }
        .row { margin-bottom: 15px; display: flex; flex-direction: column; }
        .label { font-size: 0.75rem; color: #94a3b8; text-transform: uppercase; font-weight: 700; margin-bottom: 4px; }
        .val { font-size: 0.95rem; color: #f1f5f9; background: #0f172a; padding: 10px 14px; border-radius: 8px; border: 1px solid #334155; word-break: break-all; min-height: 20px; }
        input.val, textarea.val { font-family: inherit; width: 100%; box-sizing: border-box; resize: vertical; transition: border-color 0.2s; }
        input.val:focus, textarea.val:focus { outline: none; border-color: #8b5cf6; }
        .match-badge { display: inline-block; padding: 4px 8px; border-radius: 6px; font-size: 0.7rem; font-weight: bold; margin-left: 10px; }
        .matched { background: rgba(16, 185, 129, 0.2); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); }
        .not-matched { background: rgba(239, 68, 68, 0.2); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); }
        .new-record { text-align: center; padding: 40px; color: #10b981; font-weight: bold; border: 2px dashed #10b981; border-radius: 12px; margin-top: 50px; }
        
        #toast { position: fixed; bottom: 20px; right: 20px; background: #10b981; color: white; padding: 12px 20px; border-radius: 8px; font-weight: bold; opacity: 0; transition: opacity 0.3s; pointer-events: none; z-index: 1000; }
    </style>
</head>
<body>
    <div id="toast">Değişiklikler Kaydedildi!</div>
    
    <div class="header">
        <h1>Cari Veri Düzenleme & Karşılaştırma</h1>
        <p style="color:#94a3b8">Kayıt <span id="currentIndex">1</span> / <span id="totalCount">0</span></p>
    </div>

    <div class="controls">
        <button id="prevBtn" onclick="prev()">⬅ Önceki Cari</button>
        <button id="nextBtn" onclick="next()">Sonraki Cari ➡</button>
    </div>

    <div class="container">
        <!-- SOL PANEL: UYUMSOFT JSON -->
        <div class="panel">
            <h2 class="panel-title">Uyumsoft JSON (MO-LIST.json)</h2>
            <div id="leftContent"></div>
        </div>

        <!-- SAĞ PANEL: SUPABASE -->
        <div class="panel" id="rightPanel">
            <h2 class="panel-title" style="color: #a78bfa;">Supabase (Mevcut Veritabanı) <span id="matchStatus"></span></h2>
            <div id="rightContent"></div>
        </div>
    </div>

    <script>
        let uyumsoftCariler = [];
        let supabaseCustomers = [];
        let currentIndex = 0;
        let currentRecordId = null;

        async function loadData() {
            document.getElementById('leftContent').innerHTML = "<p>Yükleniyor...</p>";
            document.getElementById('rightContent').innerHTML = "<p>Yükleniyor...</p>";
            
            try {
                const res = await fetch('/api/data');
                const data = await res.json();
                uyumsoftCariler = data.json;
                supabaseCustomers = data.db;
                document.getElementById('totalCount').innerText = uyumsoftCariler.length;
                render();
            } catch (err) {
                alert("Veri yüklenemedi: " + err);
            }
        }

        function showToast(msg, isErr = false) {
            const toast = document.getElementById('toast');
            toast.innerText = msg;
            toast.style.background = isErr ? '#ef4444' : '#10b981';
            toast.style.opacity = '1';
            setTimeout(() => { toast.style.opacity = '0'; }, 3000);
        }

        function render() {
            if(uyumsoftCariler.length === 0) return;
            document.getElementById('currentIndex').innerText = currentIndex + 1;
            
            document.getElementById('prevBtn').disabled = currentIndex === 0;
            document.getElementById('nextBtn').disabled = currentIndex === uyumsoftCariler.length - 1;

            const u = uyumsoftCariler[currentIndex];
            const uName = (u.Title || "").trim();
            const uVkn = (u.VkTckNo || "").trim();
            
            // Supabase'deki karşılığını bul
            let s = supabaseCustomers.find(c => c.vkntckn === uVkn || c.tax_number === uVkn);
            if (!s && uVkn) s = supabaseCustomers.find(c => c.name && c.name.toLowerCase() === uName.toLowerCase());

            currentRecordId = s ? s.id : null;

            // Sol Paneli Çiz (JSON)
            const jsonFields = [
                { label: 'Ad / Ünvan', val: uName },
                { label: 'VKN / TCKN', val: uVkn },
                { label: 'Vergi Dairesi', val: u.TaxOffice },
                { label: 'Ülke', val: u.AddressCountry },
                { label: 'Şehir', val: u.AddressCity },
                { label: 'Mahalle / İlçe', val: u.AddressSubDivisionName },
                { label: 'Cadde / Sokak', val: u.AddressStreetName ? u.AddressStreetName.replace(/\\r\\n|\\n|\\r/g, ' ') : '' },
                { label: 'Telefon', val: u.PhoneNumber },
                { label: 'E-Posta', val: u.Email }
            ];

            let leftHtml = '';
            jsonFields.forEach(f => {
                leftHtml += \`<div class="row"><div class="label">\${f.label}</div><div class="val">\${f.val || '-'}</div></div>\`;
            });
            document.getElementById('leftContent').innerHTML = leftHtml;

            const matchBadge = s 
                ? \`<span class="match-badge matched">✓ EŞLEŞTİ</span>\` 
                : \`<span class="match-badge not-matched">YENİ KAYIT EKLENMELİ</span>\`;
            document.getElementById('matchStatus').innerHTML = matchBadge;

            // Sağ Paneli Çiz (Supabase Editable)
            if (s) {
                let rightHtml = '';
                const fields = [
                    { key: 'name', label: 'Ad / Ünvan', val: s.name, type: 'text' },
                    { key: 'vkntckn', label: 'VKN / TCKN', val: s.vkntckn, type: 'text' },
                    { key: 'tax_office', label: 'Vergi Dairesi', val: s.tax_office, type: 'text' },
                    { key: 'country', label: 'Ülke', val: s.country, type: 'text' },
                    { key: 'city', label: 'Şehir', val: s.city, type: 'text' },
                    { key: 'district', label: 'Mahalle / İlçe', val: s.district, type: 'text' },
                    { key: 'address', label: 'Cadde / Sokak', val: s.address, type: 'textarea' },
                    { key: 'phone', label: 'Telefon', val: s.phone, type: 'text' },
                    { key: 'email', label: 'E-Posta', val: s.email, type: 'text' }
                ];

                fields.forEach(f => {
                    const valueStr = (f.val || '').replace(/"/g, '&quot;');
                    if(f.type === 'textarea') {
                        rightHtml += \`<div class="row">
                            <label class="label">\${f.label}</label>
                            <textarea id="inp_\${f.key}" class="val" rows="3">\${valueStr}</textarea>
                        </div>\`;
                    } else {
                        rightHtml += \`<div class="row">
                            <label class="label">\${f.label}</label>
                            <input id="inp_\${f.key}" class="val" type="text" value="\${valueStr}" />
                        </div>\`;
                    }
                });

                rightHtml += \`<button class="btn-save" id="saveBtn" onclick="saveData()">💾 DEĞİŞİKLİKLERİ KAYDET</button>\`;
                document.getElementById('rightContent').innerHTML = rightHtml;
            } else {
                document.getElementById('rightContent').innerHTML = \`
                    <div class="new-record">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:15px"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
                        <br/>
                        Bu Cari Supabase'de henüz kaydedilmemiş (Ekranda görünmüyor).
                    </div>
                \`;
            }
        }

        async function saveData() {
            if(!currentRecordId) return;

            const btn = document.getElementById('saveBtn');
            btn.innerText = "Kaydediliyor...";
            btn.disabled = true;

            const payload = {
                name: document.getElementById('inp_name').value,
                vkntckn: document.getElementById('inp_vkntckn').value,
                tax_office: document.getElementById('inp_tax_office').value,
                country: document.getElementById('inp_country').value,
                city: document.getElementById('inp_city').value,
                district: document.getElementById('inp_district').value,
                address: document.getElementById('inp_address').value,
                phone: document.getElementById('inp_phone').value,
                email: document.getElementById('inp_email').value
            };

            try {
                const response = await fetch(\`/api/save/\${currentRecordId}\`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                const result = await response.json();
                if(result.success) {
                    showToast('Cari başarıyla güncellendi!');
                    // Güncel veriyi locale yansıt
                    let idx = supabaseCustomers.findIndex(c => c.id === currentRecordId);
                    if(idx !== -1) {
                        supabaseCustomers[idx] = { ...supabaseCustomers[idx], ...payload };
                    }
                } else {
                    showToast('Hata: ' + result.error, true);
                }
            } catch(e) {
                showToast('Ağ hatası: ' + e.message, true);
            } finally {
                btn.innerText = "💾 DEĞİŞİKLİKLERİ KAYDET";
                btn.disabled = false;
            }
        }

        function next() { if(currentIndex < uyumsoftCariler.length - 1) { currentIndex++; render(); }  }
        function prev() { if(currentIndex > 0) { currentIndex--; render(); } }

        // Başlat
        loadData();
    </script>
</body>
</html>
`;

const server = http.createServer(async (req, res) => {
    // Statik index.html isteği
    if (req.method === 'GET' && req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(htmlContent);
    } 
    // Data listeleme API
    else if (req.method === 'GET' && req.url === '/api/data') {
        try {
            // Read JSON File
            const jsonPath = path.join(process.cwd(), 'MO-LIST.json');
            const fileData = fs.readFileSync(jsonPath, 'utf8');
            const uyumsoftCariler = JSON.parse(fileData);

            // Read Supabase Data
            const { data: supabaseCustomers, error } = await supabase.from('customers').select('*').order('created_at', { ascending: false });
            if (error) throw error;

            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({
                json: uyumsoftCariler,
                db: supabaseCustomers
            }));
        } catch (err) {
            res.writeHead(500);
            res.end(JSON.stringify({ error: err.message }));
        }
    } 
    // Data kaydetme API
    else if (req.method === 'POST' && req.url.startsWith('/api/save/')) {
        const id = req.url.split('/').pop();
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const payload = JSON.parse(body);
                const { data, error } = await supabase.from('customers').update(payload).eq('id', id);
                if (error) throw error;
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch(e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: e.message }));
            }
        });
    }
    else {
        res.writeHead(404);
        res.end("Not Found");
    }
});

server.listen(PORT, () => {
    console.log(`\n==============================================`);
    console.log(`DÜZENLENEBİLİR Arayüz hazır! Tarayıcınızda şu adrese gidin:`);
    console.log(`http://localhost:${PORT}`);
    console.log(`==============================================\n`);
});
