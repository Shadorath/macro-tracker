# Apps Script setup (one time, about 10 minutes)

This connects the "Food Log" spreadsheet to the app. The script in `Code.gs` reads and writes the **Log** and **Goals** tabs. It never touches **Daily**.

You will end up with two secrets for the app's Settings screen: the **web app URL** and the **token**. Never put either of them in the code or on GitHub.

## 1. Make a token

The token is a long random password. Every request from the app has to include it.

Open PowerShell on the PC and run this. It prints a random 64-character string:

```powershell
[guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')
```

Copy the result and keep it somewhere private that your phone can also open, such as a Google Keep note only you can see. You will paste it into the app in milestone 2.

## 2. Paste the script

1. Open the **Food Log** spreadsheet in Google Sheets on the PC.
2. Go to **Extensions → Apps Script**. A new tab opens with a file called `Code.gs`.
3. Delete everything in it, then paste in the whole contents of `apps-script/Code.gs` from this project.
4. At the top left, click "Untitled project" and rename it to **Macro Tracker backend**.
5. Press **Ctrl + S** to save.

## 3. Store the token in the script

1. In the left sidebar, click the gear icon (**Project Settings**).
2. Scroll down to **Script Properties** and click **Add script property**.
3. Property: `TOKEN`. Value: the token from step 1.
4. Click **Save script properties**.

## 4. Deploy as a web app

1. Top right: **Deploy → New deployment**.
2. Next to "Select type", click the gear and choose **Web app**.
3. Description: `v1`. **Execute as: Me**. **Who has access: Anyone**.
   ("Anyone" lets the app reach the URL. Without the token, nobody can read or write anything.)
4. Click **Deploy**. Google asks for permission the first time:
   **Authorize access → choose your account → "Google hasn't verified this app" → Advanced → Go to Macro Tracker backend (unsafe) → Allow**.
   This warning is normal for your own scripts: it is your code, running on your own sheet.
5. Copy the **Web app URL**. It ends in `/exec`. Keep it in the same private note as the token.

## 5. Test it

**a) Is it running?** Open the web app URL in your browser. You should see:
`{"ok":true,"message":"Macro Tracker backend is running. ..."}`

**b) Add a test meal and read it back.** In PowerShell, paste the block below. Put your URL and token in the first two lines, then press Enter. It saves a test snack with one apple, then asks for today's data:

```powershell
$url   = "PASTE_WEB_APP_URL_HERE"
$token = "PASTE_TOKEN_HERE"

$add = @{
  action = "addMeal"; token = $token
  meal   = @{ id = "m-test"; timestamp = (Get-Date -Format "yyyy-MM-dd HH:mm"); type = "Snack"; name = "Test meal"; source = "manual"; note = "Test from PowerShell" }
  items  = @( @{ name = "Test apple"; grams = 150; kcal = 78; protein_g = 0.4; fat_g = 0.3; carbs_g = 20.7 } )
} | ConvertTo-Json -Depth 5
Invoke-RestMethod -Uri $url -Method Post -ContentType "text/plain" -Body $add

$day = @{ action = "getDay"; token = $token; date = (Get-Date -Format "yyyy-MM-dd") } | ConvertTo-Json
Invoke-RestMethod -Uri $url -Method Post -ContentType "text/plain" -Body $day | ConvertTo-Json -Depth 6
```

What you should see:

- The first answer shows `ok: True` and `mealId: m-test`.
- The second answer lists "Test meal" with "Test apple", the totals (78 kcal) and your goals.
- In the sheet, the **Log** tab has a new row for Test apple, and **Daily** shows today with 78 kcal.

**c) Wrong token is refused.** Run this in the same PowerShell window. It sends a fake token:

```powershell
Invoke-RestMethod -Uri $url -Method Post -ContentType "text/plain" -Body (@{ action = "getDay"; token = "wrong"; date = "2026-11-14" } | ConvertTo-Json)
```

You should see `ok: False` and `error: unauthorized`.

**d) Delete the test meal.** This removes the test row from the Log tab:

```powershell
Invoke-RestMethod -Uri $url -Method Post -ContentType "text/plain" -Body (@{ action = "deleteMeal"; token = $token; mealId = "m-test" } | ConvertTo-Json)
```

You should see `deleted: 1`, and the row is gone from **Log**.

## Updating the script later

When `Code.gs` changes, paste the new version and save. Then go to **Deploy → Manage deployments**, click the pencil, set **Version: New version** and click **Deploy**.

This keeps the **same URL**. Don't use "New deployment" again: that creates a new URL, and you'd have to change it in the app.

## If something goes wrong

| You see | What to do |
| --- | --- |
| `TOKEN is not set in Script Properties` | Do step 3 again. The name must be exactly `TOKEN`. |
| `unauthorized` with your real token | Check for a missing character or an extra space at either end. |
| `Tab "Log" not found` | The tab names must be exactly `Log` and `Goals`. |
| An HTML page instead of JSON | The deployment's access isn't set to **Anyone**. Fix it under Manage deployments. |
