import os
import asyncio, json, os, time
from playwright.async_api import async_playwright
OUT="/tmp/e2e"; os.makedirs(OUT, exist_ok=True)
E1="8a013b81-e4bd-4277-887a-e9632b81c4b8"
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(headless=True, args=["--autoplay-policy=no-user-gesture-required"])
        c=await b.new_context(viewport={"width":1280,"height":1800})
        pg=await c.new_page(); errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto("http://localhost:8080/?mb_qa=1")
        await pg.evaluate(f"localStorage.setItem({json.dumps(os.environ['LOVABLE_BROWSER_SUPABASE_STORAGE_KEY'])}, {json.dumps(os.environ['LOVABLE_BROWSER_SUPABASE_SESSION_JSON'])})")
        print("start", time.strftime("%H:%M:%S", time.gmtime()))
        await pg.goto("http://localhost:8080/search?q=fight%20club"); await pg.wait_for_timeout(6000)
        r=pg.locator("main a[href^='/movie/'], main a[href^='/title/']").first
        print("search href", await r.get_attribute("href")); await r.click(); await pg.wait_for_timeout(3000)
        await pg.goto("http://localhost:8080/title/fight-club-1999"); await pg.wait_for_timeout(4000)
        wl=pg.locator("main button[aria-pressed]").first; fav=pg.get_by_role("button", name="Favorite").or_(pg.locator("main button[aria-pressed]").nth(1)).first
        for _ in range(2): await wl.click(); await pg.wait_for_timeout(1500)
        for _ in range(2): await fav.click(); await pg.wait_for_timeout(1500)
        # Series: E1, refresh twice (same session), then autoplay to E2
        for i in range(3):
            await pg.goto(f"http://localhost:8080/watch/breaking-bad-2008?ep={E1}"); await pg.wait_for_timeout(6000)
            await pg.evaluate("document.querySelector('video')?.play()"); await pg.wait_for_timeout(4000)
        await pg.wait_for_timeout(30000)
        await pg.evaluate("{const v=document.querySelector('video'); v.currentTime=v.duration-3}"); await pg.wait_for_timeout(22000)
        print("after autoplay url", pg.url)
        await pg.evaluate("document.querySelector('video')?.play()"); await pg.wait_for_timeout(35000)
        await pg.screenshot(path=f"{OUT}/3_e2.png")
        await pg.goto("http://localhost:8080/"); await pg.wait_for_timeout(6000)
        print("errors", errs[:5]); await b.close()
asyncio.run(main())
