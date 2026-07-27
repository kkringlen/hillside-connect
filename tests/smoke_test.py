import asyncio
from pathlib import Path
from playwright.async_api import async_playwright, expect

PROJECT_ROOT = Path(__file__).resolve().parents[1]
ROOT = PROJECT_ROOT / 'site'
ARTIFACTS = PROJECT_ROOT / 'tests'
SCRIPT_FILES = ['config.js', 'church-info.js', 'demo-api.js', 'supabase-api.js', 'app.js']
BASE_HTML = f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><style>{(ROOT/'styles.css').read_text()}</style></head><body><div id="app"></div><div id="modal-root"></div><div id="toast-root"></div></body></html>'''
SCRIPTS = [(ROOT / name).read_text() for name in SCRIPT_FILES]
PASSWORD = 'Demo123!'

async def build_page(browser, width=390, height=844):
    page = await browser.new_page(viewport={'width': width, 'height': height})
    errors = []
    page.on('pageerror', lambda error: errors.append(f'pageerror: {error}'))
    page.on('console', lambda message: errors.append(f'console {message.type}: {message.text}') if message.type == 'error' else None)
    await page.set_content(BASE_HTML)
    await page.evaluate('''() => {
      const store = new Map();
      const local = {
        getItem: key => store.has(String(key)) ? store.get(String(key)) : null,
        setItem: (key, value) => store.set(String(key), String(value)),
        removeItem: key => store.delete(String(key)),
        clear: () => store.clear(),
        key: index => Array.from(store.keys())[index] || null,
        get length() { return store.size; }
      };
      Object.defineProperty(window, 'localStorage', { value: local, configurable: true });
      window.HILLSIDE_TEST_DEMO = true;
    }''')
    for script in SCRIPTS:
        await page.add_script_tag(content=script)
    await expect(page.get_by_text('Hillside Connect', exact=True)).to_be_visible()
    return page, errors

async def login(page, email):
    await page.get_by_label('Email address or mobile phone').fill(email)
    await page.get_by_label('Password').fill(PASSWORD)
    await page.locator('form[data-form="auth-login"] button[type="submit"]').click()
    await expect(page.locator('.app-shell')).to_be_visible()

async def public_test(browser):
    page, errors = await build_page(browser)
    await page.get_by_role('button', name='Browse public church information').click()
    await expect(page.get_by_text('Public access')).to_be_visible()
    assert await page.get_by_role('button', name='Inbox').count() == 0
    assert await page.get_by_role('button', name='Teams').count() == 0
    await page.locator('.bottom-nav button[data-tab="events"]').click()
    await expect(page.get_by_text('Sunday Worship')).to_be_visible()
    await page.locator('.bottom-nav button[data-tab="more"]').click()
    await expect(page.get_by_text('Church information', exact=True)).to_be_visible()
    await page.screenshot(path=str(ARTIFACTS/'public-mobile.png'), full_page=True)
    assert not errors, errors
    await page.close()

async def admin_test(browser):
    page, errors = await build_page(browser)
    await login(page, 'admin@demo.local')
    for tab in ['home', 'events', 'inbox', 'teams', 'more']:
        await expect(page.locator(f'.bottom-nav button[data-tab="{tab}"]')).to_be_visible()
    await page.get_by_label('Open management').click()
    await expect(page.get_by_text('Administration', exact=True)).to_be_visible()
    await expect(page.get_by_role('heading', name='Pending Guest', exact=True)).to_be_visible()
    await page.get_by_role('button', name='Approve as member').click()
    await expect(page.get_by_text('Member', exact=True).last).to_be_visible()
    await page.locator('.bottom-nav button[data-tab="events"]').click()
    await page.locator('button[data-action="event-new"]').click()
    await page.get_by_label('Title').fill('Production Validation Event')
    await page.get_by_label('Description').fill('Created by the automated production validation test.')
    await page.get_by_label('Starts').fill('2026-08-01T10:00')
    await page.get_by_label('Location').fill('Hillside Baptist Church')
    await page.get_by_label('Audience').select_option('public')
    await page.get_by_role('button', name='Save event').click()
    await expect(page.get_by_text('Production Validation Event')).to_be_visible()
    await page.screenshot(path=str(ARTIFACTS/'admin-mobile.png'), full_page=True)
    assert not errors, errors
    await page.close()

async def leader_test(browser):
    page, errors = await build_page(browser)
    await login(page, 'leader@demo.local')
    await page.locator('.bottom-nav button[data-tab="teams"]').click()
    await page.get_by_role('button', name='Youth Team').click()
    await page.get_by_role('button', name='Discussions').click()
    await page.get_by_role('button', name='Open discussion').click()
    await expect(page.get_by_text('Fall outreach ideas', exact=True)).to_be_visible()
    await page.get_by_label('Add a comment').fill('Validated leader response.')
    await page.get_by_role('button', name='Post comment').click()
    await expect(page.get_by_text('Validated leader response.')).to_be_visible()
    await page.get_by_label('Open management').click()
    await expect(page.get_by_text('Leader tools', exact=True)).to_be_visible()
    await page.screenshot(path=str(ARTIFACTS/'leader-mobile.png'), full_page=True)
    assert not errors, errors
    await page.close()

async def member_test(browser):
    page, errors = await build_page(browser)
    await login(page, 'member@demo.local')
    assert await page.get_by_label('Open management').count() == 0
    await page.locator('.bottom-nav button[data-tab="teams"]').click()
    await expect(page.get_by_role('button', name='Youth Team')).to_be_visible()
    assert await page.get_by_role('button', name='Worship Team').count() == 0
    await page.locator('.bottom-nav button[data-tab="inbox"]').click()
    await expect(page.get_by_role('heading', name='Inbox', exact=True)).to_be_visible()
    await page.locator('button[data-action="conversation-new"]').click()
    await expect(page.get_by_role('heading', name='New direct message', exact=True)).to_be_visible()
    await page.get_by_label('Recipient').select_option(label='Wes Leader · Leader')
    await page.locator('#first-message').fill('Member-to-leader validation message.')
    await page.get_by_role('button', name='Send message').click()
    await expect(page.get_by_text('Member-to-leader validation message.')).to_be_visible()
    await page.screenshot(path=str(ARTIFACTS/'member-mobile.png'), full_page=True)
    assert not errors, errors
    await page.close()

async def guest_test(browser):
    page, errors = await build_page(browser)
    await login(page, 'guest@demo.local')
    await expect(page.get_by_text('Approval pending')).to_be_visible()
    assert await page.get_by_role('button', name='Inbox').count() == 0
    assert await page.get_by_role('button', name='Teams').count() == 0
    await page.locator('.bottom-nav button[data-tab="more"]').click()
    await page.get_by_role('button', name='Prayer requests').click()
    await expect(page.get_by_role('heading', name='Prayer requests', exact=True)).to_be_visible()
    await page.get_by_label('Name').fill('Pending Guest')
    await page.get_by_label('Prayer request').fill('Guest prayer submission validation.')
    await page.get_by_role('button', name='Submit prayer request').click()
    await expect(page.get_by_text('Prayer request submitted for leadership review.')).to_be_visible()
    await page.screenshot(path=str(ARTIFACTS/'guest-mobile.png'), full_page=True)
    assert not errors, errors
    await page.close()

async def desktop_test(browser):
    page, errors = await build_page(browser, 1440, 1000)
    await login(page, 'admin@demo.local')
    await expect(page.locator('.app-shell')).to_be_visible()
    box = await page.locator('.app-shell').bounding_box()
    assert box and box['width'] > 1000
    await page.screenshot(path=str(ARTIFACTS/'admin-desktop.png'), full_page=True)
    assert not errors, errors
    await page.close()

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        await public_test(browser)
        await admin_test(browser)
        await leader_test(browser)
        await member_test(browser)
        await guest_test(browser)
        await desktop_test(browser)
        await browser.close()
    print('PASS: 6 browser smoke-test scenarios')

if __name__ == '__main__':
    asyncio.run(main())
