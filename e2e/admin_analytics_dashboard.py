import os
import asyncio, json, os, re
from playwright.async_api import async_playwright
OUT="/tmp/e2e"; os.makedirs(OUT, exist_ok=True)
BAD=re.compile(r"\bNaN\b|undefined|\bnull\b|Infinity")
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(headless=True)
        for name,vp in [("desktop",{"width":1280,"height":1800}),("mobile",{"width":390,"height":1800})]:
            c=await b.new_context(viewport=vp); pg=await c.new_page(); errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
            await pg.goto("http://localhost:8080/?mb_qa=1")
            await pg.evaluate(f"localStorage.setItem({json.dumps(os.environ['LOVABLE_BROWSER_SUPABASE_STORAGE_KEY'])}, {json.dumps(os.environ['LOVABLE_BROWSER_SUPABASE_SESSION_JSON'])})")
            await pg.goto("http://localhost:8080/admin-analytics"); await pg.wait_for_timeout(8000)
            for preset in ["Today","7 days","30 days","Custom"]:
                await pg.get_by_role("button", name=preset, exact=True).click(); await pg.wait_for_timeout(4000)
                txt=await pg.locator("main").inner_text() if await pg.locator("main").count() else await pg.inner_text("body")
                print(name, preset, "bad:", BAD.findall(txt)[:5], "err:", "unavailable" in txt or "Invalid" in txt)
            await pg.get_by_role("button", name="Today", exact=True).click()
            await pg.get_by_label("Include test traffic").check(); await pg.wait_for_timeout(5000)
            body=await pg.inner_text("body")
            i=body.find("Active viewers"); print(name, "WITH TEST:", body[i:i+500].replace("\n"," | "))
            t=body.find("Failure rate\n"); print(name, "TABLE:", body[t:t+400].replace("\n"," | "))
            await pg.screenshot(path=f"{OUT}/admin_{name}.png")
            sw=await pg.evaluate("document.documentElement.scrollWidth"); print(name,"scrollWidth",sw,"errors",errs[:3])
            await c.close()
        await b.close()
asyncio.run(main())
