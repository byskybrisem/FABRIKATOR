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


class WebDemo(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = TemporaryDirectory()
        (Path(cls.temp.name) / "FABRIKATOR").symlink_to(Path("dist/site").resolve())
        handler = partial(QuietHandler, directory=cls.temp.name)
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.url = f"http://127.0.0.1:{cls.server.server_port}/FABRIKATOR/"
        cls.pw = sync_playwright().start()
        engine = os.environ.get("BROWSER", "webkit")
        options = {"executable_path": os.environ["CHROMIUM_PATH"]} if engine == "chromium" and os.environ.get("CHROMIUM_PATH") else {}
        cls.browser = getattr(cls.pw, engine).launch(**options)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.pw.stop()
        cls.server.shutdown()
        cls.server.server_close()
        cls.temp.cleanup()

    def setUp(self):
        self.context = self.browser.new_context(viewport={"width":440,"height":956}, has_touch=True, is_mobile=True)
        self.addCleanup(self.context.close)
        self.errors = []
        self.start = datetime(2026, 1, 1, tzinfo=timezone.utc)
        self.page = self.open(self.start)

    def open(self, when):
        page = self.context.new_page()
        page.on("pageerror", lambda err: self.errors.append(str(err)))
        page.clock.set_fixed_time(when)
        page.goto(self.url)
        expect(page.get_by_role("heading", name="Ana panel")).to_be_visible()
        return page

    def visit(self, name):
        self.page.get_by_role("navigation").get_by_role("link", name=name, exact=True).click()
        expect(self.page.get_by_role("heading", name=name, exact=True)).to_be_visible()

    def check_stat(self, label, value):
        expect(self.page.locator(".line").filter(has=self.page.get_by_text(label, exact=True)).locator("dd")).to_have_text(value)

    def test_workshop_with_closed_tab_and_offline_reload(self):
        p = self.page
        expect(p.get_by_text("150.000 TL", exact=True)).to_be_visible()
        self.visit("Depo")
        p.get_by_role("button", name="Bir parti al").click()
        self.check_stat("Tahta","20")
        self.visit("Fabrikam")
        p.get_by_role("button", name="Ustayı hatta ata").click()
        self.check_stat("Görev","Montaj hattı")
        self.visit("Üretim")
        p.get_by_role("button",name="10 sandalye üret").click()
        self.check_stat("Üretimde","10 sandalye")
        p.reload()
        self.check_stat("Depoya giriş","60 sn")
        p.evaluate("() => navigator.serviceWorker.ready")
        p.wait_for_function("!!navigator.serviceWorker.controller")
        p.close()
        self.context.set_offline(True)
        self.page = self.open(self.start + timedelta(seconds=61))
        self.visit("Depo")
        self.check_stat("Ahşap sandalye","10 adet")
        self.visit("Piyasa")
        self.page.get_by_role("button",name="10 sandalyeyi sat").click()
        expect(self.page.get_by_role("button",name="Satılacak sandalye yok")).to_be_disabled()
        self.visit("Finans")
        self.check_stat("Kasa","153.275 TL")
        self.check_stat("Sabit gider öncesi kazanç","3.275 TL")
        self.visit("Fabrikam")
        self.page.get_by_role("button",name="Makineyi geliştir").click()
        self.check_stat("Seviye","2 / 3")
        self.page.reload()
        self.check_stat("Çevrim süresi","30 sn")
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
            for view in ["Ana panel","Depo","Üretim","Piyasa","Fabrikam","Finans"]:
                self.visit(view)
                self.assertTrue(self.page.evaluate("document.documentElement.scrollWidth <= innerWidth"))
        manifest=self.page.request.get(self.url+"manifest.webmanifest").json()
        self.assertEqual(manifest["start_url"], "./")
        self.assertEqual(self.page.request.get(self.url+manifest["icons"][0]["src"]).status, 200)
        self.assertEqual(self.errors, [])


if __name__ == "__main__":
    unittest.main(verbosity=2)

