# Mozilla listing draft (Tab Labels for Firefox)

Text to paste into the add-on's details on addons.mozilla.org. This file is not part of the extension package.
Check the limits shown by the form as you paste; the summary below is 203 characters.

## Name
Tab Labels

## Add-on URL
tab-labels (if it is taken, the form suggests another)

## Summary
Tag tabs with coloured labels such as Waiting, Paused and To do. Built for developers who label environments in Firefox Containers and track pull requests and merge requests. Nothing leaves your browser.

## Description
Tag your tabs with coloured labels, so you can see at a glance which ones are waiting, paused or still to do.

Initially built for developers who want to label multiple environments in multiple Firefox Containers, and manage the status of pull requests and merge requests.

What it does
- Right-click a tab, choose Label tab, pick a label. Choose Remove label to clear it.
- Three labels to start with: Waiting, Paused and To do. Add your own, each with an emoji, a colour and an optional name.
- Show labels the way you like with three separate switches: a coloured dot on the tab icon, the label name in the title, and the emoji in the title.
- Containers: give a container a label, and every new tab opened in it gets that label automatically. It works well alongside Container Bookmarks, a separate add-on that opens bookmarks in a container of your choice: a bookmark opens in its container and, once you have picked a label for that container, arrives already labelled. Tab Labels is not affiliated with Container Bookmarks.
- An emoji picker with search. Your computer's own emoji menu works in its search box too.
- Export your labels to a file and import them on another computer.
- A tab keeps its label while you browse, and after Firefox restarts if Firefox restores your tabs.
- One button, Refresh labels on all tabs, takes the labels off every open tab and puts them back.
- A little extra: press "Take me to space" at the top right of the settings for a pastel purple sky with little planets and stars (and "Land back" to return). A sun/moon button next to it switches between light and dark mode.

Privacy
Tab Labels collects no data. It has no accounts, no analytics and no server. Your labels and settings are saved in your own browser. The extension only reads and changes two things on a page: its title and its icon. When the coloured dot is switched on, then for a tab that has a label it fetches that page's own icon from the same website, so it can draw the dot on it. Nothing else is requested, and nothing is sent about you.

Needs Firefox 140 or newer on a computer.

## Categories
Choose up to two, for example Tabs and Web Development.

## Platforms
Firefox for desktop only (untick Android).

## Support
- Support website: https://github.com/moamstripes/tab-labels/issues
- Homepage: https://moamstripes.github.io/tab-labels/
- A support email is optional. It is shown publicly, so leave it empty if you prefer.

## License
MIT

## Privacy policy
Paste the Privacy paragraph above, or link to https://moamstripes.github.io/tab-labels/#privacy

## Screenshots
Use the pictures in docs/assets of the repository: settings-light.png, emoji-picker.png and settings-space.png.

## Notes for reviewers
No build step, no minification, no bundler and no third-party code: the uploaded package is the source, so no separate source upload is needed. The source is also at https://github.com/moamstripes/tab-labels (firefox folder).

How to try it: open the add-on's settings (about:addons, Tab Labels, Preferences). Right-click any tab, choose Label tab, then a label. The tab title gets the emoji and name, and the tab icon gets a coloured dot. For containers, pick a label for a container in the settings and open a new tab in that container.

Why each permission is needed:
- Access to all websites (host permission): to change the title and icon of any page the user labels. Nothing else on a page is read or changed.
- menus: to add Label tab to the tab context menu.
- tabs: to find open tabs and tell them to update.
- storage: to save the user's labels and settings.
- sessions: to remember each tab's label, including after a restart.
- contextualIdentities: to list the user's containers so each can have a label.
- cookies: only so Firefox reports which container a tab belongs to (tab.cookieStoreId). No cookie is read or written.
- scripting: to add the content script to tabs that were already open when the extension was installed or updated (the Refresh labels on all tabs button).

Network use: the background script fetches the favicon of a labelled page, from that page's own website without credentials, to draw the label dot on it. No other requests are made. data_collection_permissions is declared as none.
