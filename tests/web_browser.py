"""Run after npm run build:web. Uses a real IndexedDB and the Pages project subpath."""
import os
import threading
import unittest
from datetime import datetime, timedelta, timezone
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from tempfile import TemporaryDirectory

from playwright.sync_api import sync_playwright, expect


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def send_error(self, code, message=None, explain=None):
        # Mirror GitHub Pages: unknown paths get the site's 404.html.
        page = Path(self.directory) / "FABRIKATOR" / "404.html"
        if code != 404 or not page.exists():
            return super().send_error(code, message, explain)
        body = page.read_bytes()
        self.send_response(404)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


class WebDemo(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = TemporaryDirectory()
        (Path(cls.temp.name) / "FABRIKATOR").symlink_to(Path("dist/site").resolve())
        cls.pw = sync_playwright().start()
        engine = os.environ.get("BROWSER", "webkit")
        options = {"executable_path": os.environ["CHROMIUM_PATH"]} if engine == "chromium" and os.environ.get("CHROMIUM_PATH") else {}
        cls.engine = getattr(cls.pw, engine)
        cls.options = options

    @classmethod
    def tearDownClass(cls):
        cls.pw.stop()
        cls.temp.cleanup()

    def setUp(self):
        handler = partial(QuietHandler, directory=self.temp.name)
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        self.url = f"http://127.0.0.1:{self.server.server_port}/FABRIKATOR/"
        self.addCleanup(self.server.server_close)
        self.addCleanup(self.server.shutdown)
        profile = TemporaryDirectory()
        self.addCleanup(profile.cleanup)
        self.context = self.engine.launch_persistent_context(profile.name, viewport={"width":440,"height":956}, has_touch=True, is_mobile=True, **self.options)
        self.addCleanup(self.context.close)
        self.errors = []
        self.start = datetime(2026, 1, 1, tzinfo=timezone.utc)
        self.page = self.open(self.start)

    def open(self, when, path="", heading="Ana panel"):
        page = self.context.new_page()
        page.on("pageerror", lambda err: self.errors.append(str(err)))
        page.clock.set_fixed_time(when)
        page.goto(self.url + path)
        expect(page.get_by_role("heading", name=heading, exact=True)).to_be_visible()
        return page

    def put_raw(self, record):
        self.page.evaluate("""async (record) => {
          const {openSave}=await import('./web/storage.js');
          const db=await openSave();
          await new Promise((ok,fail)=>{const tx=db.transaction('workshop','readwrite');
            tx.objectStore('workshop').put(record,1); tx.oncomplete=ok; tx.onabort=fail;});
          db.close();
        }""", record)

    def stored(self):
        return self.page.evaluate("""async () => {
          const {openSave}=await import('./web/storage.js');
          const db=await openSave();
          const all=await new Promise(ok=>{const out={};const tx=db.transaction('workshop');
            const c=tx.objectStore('workshop').openCursor();
            c.onsuccess=()=>{const cur=c.result; if(!cur) return ok(out); out[String(cur.key)]=cur.value; cur.continue();};});
          db.close(); return all;
        }""")

    SLUGS = {"Ana panel": "panel", "Fabrikam": "fabrikam", "Depo": "depo", "Üretim": "uretim", "Piyasa": "piyasa", "Siparişler": "siparisler", "Finans": "finans", "Şirketim": "sirket"}

    def visit(self, name):
        self.page.goto(self.url + "#" + self.SLUGS[name])
        expect(self.page.get_by_role("heading", name=name, exact=True)).to_be_visible()

    def set_game(self, change):
        """Kayıtlı oyunu doğrudan düzenler (ör. bilinen bir teklif koymak için) ve sayfayı yeniler."""
        saved = self.stored()["1"]
        change(saved["game"])
        self.put_raw(saved)
        self.page.reload()

    def check_stat(self, label, value):
        expect(self.page.locator(".line").filter(has=self.page.get_by_text(label, exact=True)).locator("dd")).to_have_text(value)

    def check_tile(self, label, value):
        expect(self.page.locator(".stat").filter(has=self.page.locator("> span", has_text=label)).locator("strong")).to_have_text(value)

    def test_workshop_with_closed_tab_and_offline_reload(self):
        p = self.page
        expect(p.locator(".chip.cash")).to_have_text("150.000 TL")
        self.visit("Depo")
        p.get_by_role("button", name="Ahşap sandalye partisi al").click()
        self.check_tile("Tahta","20 adet")
        self.visit("Fabrikam")
        p.get_by_role("button", name="Hatta ata").click()
        self.check_tile("Hatta","1 / 2")
        self.visit("Üretim")
        p.get_by_role("button",name="10 sandalye üret").click()
        self.check_stat("Üretimde","10 sandalye")
        p.reload()
        self.check_stat("Depoya giriş","60 sn")
        p.evaluate("() => navigator.serviceWorker.ready")
        p.wait_for_function("!!navigator.serviceWorker.controller")
        p.close()
        # Stop the origin itself: both engines must now load from the installed worker.
        self.server.shutdown()
        self.server.server_close()
        self.page = self.open(self.start + timedelta(seconds=61))
        self.visit("Depo")
        self.check_stat("Ahşap sandalye","10 adet")
        self.visit("Piyasa")
        self.page.get_by_role("button",name="10 sandalyeyi sat").click()
        expect(self.page.get_by_role("button",name="Satılacak sandalye yok")).to_be_disabled()
        self.visit("Finans")
        self.check_stat("Kasa","153.275 TL")
        self.check_stat("Sabit gider öncesi kazanç","+3.275 TL")
        self.visit("Fabrikam")
        self.page.get_by_role("button",name="Makineyi geliştir").click()
        expect(self.page.get_by_role("heading", name="Montaj hattı · Seviye 2")).to_be_visible()
        self.page.reload()
        self.check_tile("Tek parti süresi","30 sn")
        self.assertEqual(self.errors, [])

    def test_conflicting_revisions_and_insufficient_stock_and_cash(self):
        result = self.page.evaluate("""async () => {
          const {openSave,transact}=await import('./web/storage.js');
          const a=await openSave(), b=await openSave(), now=Date.now();
          let {game:g}=await transact(a);
          async function pair(command,quantity=1){
            const intent={command,revision:g.rev,quantity,quoteDay:1};
            const results=await Promise.allSettled([transact(a,intent,now),transact(b,intent,now)]);
            g=(await transact(a)).game;
            return results.filter(r=>r.status==="fulfilled").length;
          }
          const purchases=await pair("buy");
          g=(await transact(a,{command:"assign",revision:g.rev},now)).game;
          const oversized=await pair("start",2);
          await pair("start"); g=(await transact(a,undefined,g.ready)).game;
          const sales=await pair("sell",10), balance=g.cash;
          while(g.cash>=400000) g=(await transact(a,{command:"buy",revision:g.rev},now)).game;
          const rev=g.rev, overdraft=await pair("buy");
          a.close(); b.close(); return {purchases,oversized,sales,balance,overdraft,unchanged:g.rev===rev};
        }""")
        self.assertEqual(result, {"purchases":1,"oversized":0,"sales":1,"balance":15327500,"overdraft":0,"unchanged":True})

    def test_layout_and_home_screen_manifest(self):
        for width in [320,375,440,768,1440]:
            self.page.set_viewport_size({"width":width,"height":900})
            for view in ["Ana panel","Depo","Üretim","Piyasa","Siparişler","Fabrikam","Finans","Şirketim"]:
                self.visit(view)
                self.assertTrue(self.page.evaluate("document.documentElement.scrollWidth <= innerWidth"))
        # Kart içindeki plan başlıkları sayfa başlığının yapışkan stilini almaz.
        self.page.set_viewport_size({"width":440,"height":956})
        self.visit("Üretim")
        self.assertEqual(self.page.locator(".plan header").first.evaluate("e => getComputedStyle(e).position"), "static")
        manifest=self.page.request.get(self.url+"manifest.webmanifest").json()
        self.assertEqual(manifest["start_url"], "./")
        self.assertEqual(self.page.request.get(self.url+manifest["icons"][0]["src"]).status, 200)
        self.assertEqual(self.errors, [])

    def test_direct_links_survive_reload(self):
        p = self.open(self.start, "depo", "Depo")
        self.assertTrue(p.url.endswith("/FABRIKATOR/#depo"))
        p.reload()
        expect(p.get_by_role("heading", name="Depo", exact=True)).to_be_visible()
        p.goto(self.url + "#piyasa")
        expect(p.get_by_role("heading", name="Piyasa", exact=True)).to_be_visible()
        self.assertEqual(self.errors, [])

    def test_double_tap_buys_once_and_reset_needs_confirmation(self):
        p = self.page
        self.visit("Depo")
        p.get_by_role("button", name="Ahşap sandalye partisi al").dblclick()
        self.check_tile("Tahta", "20 adet")
        p.reload()
        self.check_tile("Tahta", "20 adet")
        self.visit("Finans")
        self.check_stat("Kasa", "146.000 TL")
        p.once("dialog", lambda d: d.dismiss())
        p.get_by_role("button", name="Yeni oyun başlat").click()
        self.check_stat("Kasa", "146.000 TL")
        p.once("dialog", lambda d: d.accept())
        p.get_by_role("button", name="Yeni oyun başlat").click()
        expect(p.get_by_role("heading", name="Ana panel")).to_be_visible()
        expect(p.locator("#message")).to_have_text("Yeni oyun başladı.")
        expect(p.locator(".chip.cash")).to_have_text("150.000 TL")
        backups = [k for k in self.stored() if k.startswith("yedek-")]
        self.assertEqual(len(backups), 1)
        self.assertEqual(self.errors, [])

    def test_corrupt_save_is_kept_until_player_confirms(self):
        bad = {"version": 1, "game": {"cash": -5}, "log": []}
        self.put_raw(bad)
        self.page.reload()
        p = self.page
        expect(p.get_by_role("heading", name="Kayıt açılamadı")).to_be_visible()
        p.once("dialog", lambda d: d.dismiss())
        p.get_by_role("button", name="Kaydı yedekle, yeni oyun başlat").click()
        self.assertEqual(self.stored()["1"], bad)
        p.once("dialog", lambda d: d.accept())
        p.get_by_role("button", name="Kaydı yedekle, yeni oyun başlat").click()
        expect(p.locator(".chip.cash")).to_have_text("150.000 TL")
        saved = self.stored()
        self.assertEqual([saved[k] for k in saved if k.startswith("yedek-")], [bad])
        self.assertEqual(saved["1"]["version"], 3)

    def test_back_to_back_resets_keep_the_played_save(self):
        result = self.page.evaluate("""async () => {
          const {openSave,transact,resetSave}=await import('./web/storage.js');
          const db=await openSave(); let g=(await transact(db)).game;
          g=(await transact(db,{command:'buy',revision:g.rev})).game;
          const t=Date.now();
          await resetSave(db,t); await resetSave(db,t);
          const backups=await new Promise(ok=>{const out=[];const c=db.transaction('workshop').objectStore('workshop').openCursor();
            c.onsuccess=()=>{const cur=c.result; if(!cur) return ok(out); if(String(cur.key).startsWith('yedek-')) out.push(cur.value.game.materials.board.qty); cur.continue();};});
          db.close(); return backups;
        }""")
        self.assertEqual(result, [20])

    def test_hiring_and_crew_change_cycle_and_wages(self):
        p = self.page
        self.visit("Fabrikam")
        self.check_tile("Toplam çalışan", "1 / 6")
        self.check_tile("Boşta", "1")
        p.get_by_role("button", name="Montaj çalışanı al").click()
        self.check_tile("Toplam çalışan", "2 / 6")
        self.check_tile("Günlük maaş", "900 TL")
        p.get_by_role("button", name="Hatta ata").click()
        self.check_tile("Hatta", "1 / 2")
        p.wait_for_timeout(500)
        p.get_by_role("button", name="Hatta ata").click()
        self.check_tile("Hatta", "2 / 2")
        expect(p.get_by_role("button", name="Hatta ata")).to_be_disabled()
        expect(p.get_by_role("button", name="Boştaki çalışanı çıkar")).to_be_disabled()
        self.check_tile("Tek parti süresi", "30 sn")
        self.visit("Depo"); p.get_by_role("button", name="Ahşap sandalye partisi al").click()
        self.visit("Üretim"); p.get_by_role("button", name="10 sandalye üret").click()
        self.check_stat("Depoya giriş", "30 sn")
        self.visit("Finans")
        self.check_stat("İşçilik gideri", "−450 TL")
        self.check_stat("Kasa", "145.050 TL")
        self.assertEqual(self.errors, [])

    def test_new_day_payroll_is_recorded_once(self):
        self.page.close()
        later = self.start + timedelta(minutes=5, seconds=1)
        for _ in range(2):
            self.page = self.open(later, "#finans", "Finans")
            self.check_stat("Kasa", "149.550 TL")
            self.page.close()
        self.page = self.open(later, "#finans", "Finans")
        expect(self.page.locator(".log .line").filter(has_text="Günlük maaş ödemesi")).to_have_count(1)

    def test_version_one_save_migrates_with_one_worker(self):
        p = self.page
        self.visit("Depo"); p.get_by_role("button", name="Ahşap sandalye partisi al").click()
        self.check_tile("Tahta", "20 adet")
        old = self.stored()["1"]
        # Sürüm 1: çalışan sistemi ve çok ürün öncesi tek ürünlü kayıt.
        game = old["game"]
        for key in ("staff", "wages", "paidDay", "materials", "goods", "jobProduct", "penalties", "writeoffs", "rep", "offerDay", "offers", "orders", "delivered"):
            del game[key]
        game.update(lots=1, rawCost=400000, chairs=0, goodsCost=0, taken=0)
        old["version"] = 1
        self.put_raw(old)
        p.reload()
        self.visit("Fabrikam")
        self.check_tile("Toplam çalışan", "1 / 6")
        saved = self.stored()["1"]
        self.assertEqual(saved["version"], 3)
        self.assertEqual([saved["game"][k] for k in ("staff", "workers", "wages")], [1, 0, 0])
        self.assertEqual(saved["game"]["materials"]["board"], {"qty": 20, "cost": 300000})
        self.assertEqual(self.errors, [])

    OFFER = {"id": "1-0", "customer": 0, "product": "chair", "qty": 10, "price": 950000, "shipping": 40000, "rep": 3, "dueDay": 2, "ceiling": 1100000}

    def make_chairs(self):
        p = self.page
        self.visit("Depo"); p.get_by_role("button", name="Ahşap sandalye partisi al").click()
        self.check_tile("Tahta", "20 adet")
        self.visit("Fabrikam"); p.get_by_role("button", name="Hatta ata").click()
        self.check_tile("Hatta", "1 / 2")
        self.visit("Üretim"); p.get_by_role("button", name="10 sandalye üret").click()
        self.check_stat("Üretimde", "10 sandalye")
        p.close()
        self.page = self.open(self.start + timedelta(seconds=61), "#depo", "Depo")
        self.check_stat("Ahşap sandalye", "10 adet")

    def test_customer_order_accept_produce_deliver(self):
        self.set_game(lambda g: g.update(offers=[self.OFFER]))
        p = self.page
        self.visit("Siparişler")
        offer = p.locator(".offer").filter(has_text="Marmara Mobilya AŞ")
        expect(offer.locator(".line").filter(has_text="Tahmini net kazanç").locator("dd")).to_have_text("+4.125 TL")
        offer.get_by_role("button", name="Kabul et").click()
        expect(p.locator(".order").filter(has_text="Marmara Mobilya AŞ")).to_be_visible()
        expect(p.get_by_role("button", name="Teslim et")).to_be_disabled()
        p.wait_for_timeout(500)
        self.make_chairs()
        self.visit("Piyasa")
        expect(self.page.locator(".line").filter(has_text="Açık siparişlerin ihtiyacı")).to_be_visible()
        self.visit("Siparişler")
        self.page.get_by_role("button", name="Stoktan ayır").click()
        self.visit("Piyasa")
        expect(self.page.get_by_role("button", name="Satılacak sandalye yok")).to_be_disabled()
        self.visit("Siparişler")
        self.page.get_by_role("button", name="Teslim et").click()
        expect(self.page.locator("#message")).to_contain_text("teslim edildi")
        self.check_tile("İtibar", "13 / 100")
        self.visit("Finans")
        self.check_stat("Satış geliri", "9.500 TL")
        self.check_stat("Nakliye", "−400 TL")
        self.check_stat("Oyun vergisi", "−475 TL")
        self.check_stat("Kasa", "154.125 TL")
        self.page.reload()
        self.check_stat("Kasa", "154.125 TL")
        self.assertEqual(self.errors, [])

    def test_counter_offer_outcomes_and_declines(self):
        low = dict(self.OFFER, id="1-1", customer=1, ceiling=960000)
        self.set_game(lambda g: g.update(offers=[self.OFFER, low]))
        p = self.page
        self.visit("Siparişler")
        p.locator(".offer").filter(has_text="Marmara Mobilya AŞ").get_by_role("button", name="Karşı teklif").click()
        expect(p.locator("#message")).to_have_text("Müşteri karşı teklifi kabul etti; sipariş açıldı.")
        expect(p.locator(".order").locator(".line").filter(has_text="Sözleşme bedeli").locator("dd")).to_have_text("10.450 TL")
        p.locator(".offer").filter(has_text="Ege Ev Dekorasyon").get_by_role("button", name="Karşı teklif").click()
        expect(p.locator("#message")).to_contain_text("tekliften çekildi")
        expect(p.locator(".offer")).to_have_count(0)
        saved = self.stored()["1"]["game"]
        self.assertEqual([o["id"] for o in saved["orders"]], ["1-0"])
        self.assertEqual(saved["offers"], [])

    def test_new_build_shows_update_and_keeps_the_save(self):
        import shutil
        site = Path(self.temp.name) / "guncel"
        shutil.copytree(Path("dist/site").resolve(), site / "FABRIKATOR")
        handler = partial(QuietHandler, directory=str(site))
        server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        self.addCleanup(server.server_close)
        self.addCleanup(server.shutdown)
        url = f"http://127.0.0.1:{server.server_port}/FABRIKATOR/"
        p = self.context.new_page()
        p.clock.set_fixed_time(self.start)
        p.goto(url)
        expect(p.get_by_role("heading", name="Ana panel")).to_be_visible()
        p.evaluate("() => navigator.serviceWorker.ready")
        p.wait_for_function("!!navigator.serviceWorker.controller")
        old = p.locator("#build").inner_text()
        p.goto(url + "#depo")
        p.get_by_role("button", name="Ahşap sandalye partisi al").click()
        expect(p.locator(".card .stat").filter(has=p.locator("> span", has_text="Tahta")).locator("strong")).to_have_text("20 adet")
        # Yeni yayın: çalışan ve sayfa yeni sürüm kimliği taşır.
        root = site / "FABRIKATOR"
        sw = (root / "sw.js").read_text()
        (root / "sw.js").write_text(sw.replace('const name = prefix + "', 'const name = prefix + "yeni-'))
        index = (root / "index.html").read_text()
        (root / "index.html").write_text(index.replace(old, "Sürüm yeni-surum"))
        p.evaluate("() => navigator.serviceWorker.getRegistration().then((r) => r.update())")
        expect(p.locator("#update")).to_be_visible(timeout=15000)
        p.get_by_role("button", name="Güncelle").click()
        expect(p.locator("#build")).to_have_text("Sürüm yeni-surum", timeout=15000)
        p.goto(url + "#depo")
        expect(p.locator(".card .stat").filter(has=p.locator("> span", has_text="Tahta")).locator("strong")).to_have_text("20 adet")

    def test_newer_save_version_is_not_overwritten(self):
        newer = {"version": 99, "game": {}, "log": []}
        self.put_raw(newer)
        self.page.reload()
        expect(self.page.get_by_text("daha yeni bir sürümüyle")).to_be_visible()
        self.assertEqual(self.stored()["1"], newer)

    def test_second_tab_follows_and_stale_actions_are_rejected(self):
        a = self.page
        b = self.open(self.start, "#depo", "Depo")
        self.visit("Depo")
        a.get_by_role("button", name="Ahşap sandalye partisi al").click()
        # The other tab refreshes from the broadcast instead of keeping old stock.
        expect(b.locator(".card .stat").filter(has=b.locator("> span", has_text="Tahta")).locator("strong")).to_have_text("20 adet")
        result = a.evaluate("""async () => {
          const {openSave,transact,resetSave}=await import('./web/storage.js');
          const db=await openSave(); const before=(await transact(db)).game;
          await resetSave(db, before.born+1);
          const errs=[];
          try { await transact(db,{command:'buy',revision:0,born:before.born}); } catch(e){ errs.push(e.message); }
          const after=(await transact(db)).game; db.close();
          return {errs, cash:after.cash, lots:after.materials.board.qty};
        }""")
        self.assertEqual(result["cash"], 15000000)
        self.assertEqual(result["lots"], 0)
        self.assertIn("yeni oyun", result["errs"][0])

    def test_finish_once_across_reloads_and_clock_rollback(self):
        p = self.page
        self.visit("Depo"); p.get_by_role("button", name="Ahşap sandalye partisi al").click()
        self.visit("Fabrikam"); p.get_by_role("button", name="Hatta ata").click()
        self.visit("Üretim"); p.get_by_role("button", name="10 sandalye üret").click()
        self.check_stat("Üretimde", "10 sandalye")  # committed before the tab closes
        p.close()
        # Device clock moved backwards: still in production, never negative time.
        self.page = self.open(self.start - timedelta(hours=2), "#uretim", "Üretim")
        self.check_stat("Depoya giriş", "60 sn")
        self.page.close()
        later = self.start + timedelta(seconds=60)
        first = self.open(later, "#depo", "Depo")
        second = self.open(later, "#depo", "Depo")
        for tab in (first, second):
            tab.reload()
            expect(tab.locator(".line").filter(has=tab.get_by_text("Ahşap sandalye", exact=True)).locator("dd")).to_have_text("10 adet")
        self.page = second
        self.visit("Finans")
        self.check_stat("Kasa", "145.500 TL")
        self.assertEqual(self.errors, [])


if __name__ == "__main__":
    unittest.main(verbosity=2)

