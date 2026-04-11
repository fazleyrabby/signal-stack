# Docker Prod Update - Merge Conflict Fix on VPS (fazley@192.168.0.110 ~/signal-stack)

**Status:** Deploy script interrupted at backend build due to git merge conflicts + stashes.

**Git State:** Unmerged paths in 5 files, branch up-to-date origin/main (eeff209), old stashes present.

## Plan Steps
- [ ] **1. Abort conflicted merge** `git merge --abort`
- [ ] **2. Clear stashes** `git stash clear`
- [ ] **3. Reset to clean upstream** `git reset --hard origin/main`
- [ ] **4. Verify clean** `git status`
- [ ] **5. Re-run deploy** `./scripts/deploy.sh`
- [ ] **6. Health checks** Backend 3000, Frontend 3001
- [ ] **7. Container status** `docker ps`

**Expected:** Clean TS build, services restarted with new geo heatmap feature.

Updated: $(date)
