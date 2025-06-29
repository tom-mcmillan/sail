ChatGPT Synced Connectors
Updated this week
Google Drive Synced Connector
Note: This synced connector is currently available to Pro, Team, Enterprise and Edu plans.

Synced connectors enable you to find answers faster, reduce context-switching between tools, and make more informed decisions by bringing the most relevant internal information from connectors, or connected apps, into ChatGPT’s response.

Please note that connectors like Google Drive are provided by third parties and also subject to their terms of use, and your workspace admin can choose which connectors to enable or disable for your workspace.

 

Using Synced Connectors
ChatGPT can automatically decide when to use synced connectors like Google Drive to answer your questions, like “Find the deck from our last quarterly review” or “Summarize our 2024 go-to-market strategy.”

 

You can also explicitly ask ChatGPT to search your synced connector by including a prompt like “Search our Drive for...” or by toggling it on in the UI: Search connectors → Sources → Google Drive.

 

If you'd prefer ChatGPT not access your synced connectors for a particular question, you can include a prompt like “don’t search internally.”

 

Enabling synced connectors
For detailed instructions to connect Google Drive to your workspace, please visit our article here: Google Drive Synced Connectors - Self-Service Setup

 

Supported Data Types
Currently, users can only use the synced connector to connect to Google Workspace Drive, not personal Drive accounts. We support a range of file types from Google Drive, including:

Google Docs

Google Slides

PDFs

Word documents

PowerPoint presentations

Plain text files

Markdown files

Please note that images and charts embedded within these files aren’t supported at this time.

 

Google Sheets and Excel workbooks are partially supported. The model can search and read these spreadsheets for basic queries, but support of advanced data analysis is limited.

 

FAQ
Why use a synced connector over an access connector?
Syncing can improve response speed and quality, especially for knowledge-heavy prompts like strategy summaries or policy lookups.

 

Why can’t I see connectors?
There are a few reasons why connectors might not be visible in your ChatGPT workspace:

Gradual rollout: We’re gradually enabling connectors for Team, Enterprise, and Edu workspaces over the next few weeks. If you don’t see them yet, your workspace may not have access just yet.

Admin settings: Even after rollout, your admins can control which connectors are enabled in your workspace. If a connector is not turned on, end users won’t see it.

Outdated app version: On mobile, make sure you’re using the latest version of the ChatGPT app. Connectors require an up-to-date build to appear.

If you’ve confirmed all of the above and still don’t see connectors, try checking again in a few days or contact your workspace admin.

 

What models support Google Drive synced connectors?
Google Drive synced connectors are currently compatible with GPT-4o, OpenAI o4-mini, and o3 models.

 

How are permissions respected?
Existing permissions are fully respected and kept regularly up to date. Connectors are designed to enable your employees to only discover content via ChatGPT that they can already access in Google Drive.

This means each employee may receive different responses for the same prompt.

ChatGPT keeps up to date on both changes to files/channels as well as users' access to them. For Google Drive, the exact mechanism of this differs depending on how you connect — either we directly record whether a user has access to a file or we sync the permissions for the file itself and associated directory information in order to resolve group membership.

 

How does syncing work?
Synced connectors require a one time initial syncing of files; this will take some time as we index all data from this source, enabling real time retrieval in context of your ChatGPT queries while respecting all existing file permissions. After this initial sync, files/permissions are automatically updated on a regular basis (within minutes) to reflect recent changes—no action is required to keep your content up to date.

Initial syncing can vary depending on how many files you have access to, but happens in a few stages once you connect a source:

Sync Initiation

We’ve initiated the indexing for this source.

It isn’t yet available in ChatGPT as context, but we’re working on it. Depending on the size of your organization, the full sync may take up to a few days.

Partial Sync

Your most recent data is now available and ready to search

We’re still completing the full sync in the background, so some results may be missing for now but we’ve synced your most recent data (approximately past 30 days but may vary). Depending on the size of your organization, this process may take up to a few days

Complete Sync

Your data is fully synced!

All information from this source is now available as context within ChatGPT. From here on, it will be regularly refreshed to keep things as close to real time as possible.

 
Are there any limits to content retrieval effectiveness or accuracy?
Synced connectors are initially designed to work best for Q&A and search related queries. The most relevant data is sent to the model based on query intent, limiting performance in scenarios requiring aggregation from numerous sources or very complex queries, such as financial data aggregations.

 

Can I rename my connection?
Currently, names for synced connections cannot be updated.

 

Can I use synced connectors on my desktop apps (Windows/macOS) or mobile apps (iOS/Android)?
Currently, only the Windows app has parity with the full experience on ChatGPT.com. We are working toward bringing the full connector experience to the rest of our apps - please stay tuned!

 

Can I paste Google Drive links to reference them?
Yes, the Google Drive synced connector allows you to reference Google Drive links, e.g. "summarize this [Google Doc link]" as long as the Google Doc is synced and the user has permission to access it.

 

Why can’t I use file sync connectors if I have data residency enabled outside the US?
Synced connectors are currently only supported for customers either based in the US with data residency enabled or for those who have not elected for data residency at-rest. We don’t yet support in-region storage for non-US data residency configurations, but expanding support is on the roadmap.

 

What other connectors will be available in the future?
We’re working on connecting ChatGPT to more tools teams rely on every day—from docs and collaboration to data, CRM, and more.