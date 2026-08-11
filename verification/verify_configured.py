import os
import time
from playwright.sync_api import sync_playwright, expect

def test_configured_portal():
    os.makedirs("/app/verification", exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        console_messages = []
        page.on("console", lambda msg: console_messages.append(msg.text))

        print("Navigating to http://localhost:3000/...")
        page.goto("http://localhost:3000/")

        # Give it a brief moment to render
        page.wait_for_load_state("networkidle")
        time.sleep(2)

        print("Verifying if the unconfigured warning card is absent...")
        warning = page.locator("text=Firebase belum dikonfigurasi")
        expect(warning).not_to_be_visible()
        print("Warning card is successfully absent!")

        # Verify inputs can be typed into
        email_input = page.locator("#login-email")
        password_input = page.locator("#login-password")

        expect(email_input).to_be_visible()
        expect(email_input).not_to_be_disabled()
        expect(password_input).not_to_be_disabled()

        print("Typing credentials...")
        email_input.fill("testworker@example.com")
        password_input.fill("securepassword123")

        # Take screenshot of populated inputs
        page.screenshot(path="/app/verification/configured_typed.png")
        print("Screenshot of populated inputs saved.")

        # Click Masuk and look for error
        print("Clicking login button...")
        submit_btn = page.get_by_role("button", name="Masuk")
        submit_btn.click()

        # Wait for the Firebase Auth request response to toast or print to console
        time.sleep(3)

        page.screenshot(path="/app/verification/configured_after_login.png")
        print("Final screenshot saved to configured_after_login.png")

        browser.close()

if __name__ == "__main__":
    test_configured_portal()
