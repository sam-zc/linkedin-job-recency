# Domain language

- **Search session**: the search state captured when the popup opens, followed by an Apply action. The Chrome session updates the same tab; the localhost session previews the selected filters.
- **Time window**: a positive number of hours requested through LinkedIn's `f_TPR` parameter.
- **Classic search**: LinkedIn's `/jobs/search/` route, used when applying a time window.
- **Job card**: a recognized LinkedIn search result containing a job link and optional state labels. Unrecognized lists and job details are left visible.
- **Job visibility**: the saved choices to hide cards marked Applied or Viewed. These choices change the displayed cards, not LinkedIn's result count.
