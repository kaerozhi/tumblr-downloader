document.addEventListener('DOMContentLoaded', () => {
    // === UI 元素获取 ===
    const navDashboard = document.getElementById('navDashboard');
    const navDetail = document.getElementById('navDetail');
    const navSettings = document.getElementById('navSettings');
    
    const dashboardView = document.getElementById('dashboardView');
    const detailView = document.getElementById('detailView');
    const settingsView = document.getElementById('settingsView');

    const apiKeyInput = document.getElementById('apiKeyInput');
    const btnSaveSettings = document.getElementById('btnSaveSettings');
    
    const actionBtn = document.getElementById('actionBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const blogInput = document.getElementById('blogInput');
    const statusArea = document.getElementById('statusArea');
    
    const overviewPanel = document.getElementById('overviewPanel');
    const infoTitle = document.getElementById('infoTitle');
    const infoTotal = document.getElementById('infoTotal');
    const infoUpdated = document.getElementById('infoUpdated');
    const chkPhoto = document.getElementById('chkPhoto');
    const chkVideo = document.getElementById('chkVideo');
    const dateInput = document.getElementById('dateInput');

    // 批量操作与子标签
    const chkSelectAll = document.getElementById('chkSelectAll');
    const btnCheckUpdates = document.getElementById('btnCheckUpdates');
    const btnDownloadUpdates = document.getElementById('btnDownloadUpdates');
    const subTabActive = document.getElementById('subTabActive');
    const subTabArchived = document.getElementById('subTabArchived');
    const countActive = document.getElementById('countActive');
    const countArchived = document.getElementById('countArchived');

    // === 核心数据状态 ===
    let appData = JSON.parse(localStorage.getItem('tumblr_manager_data')) || {
        config: { apiKey: '' },
        trackedBlogs: {}
    };

    // 当前处于哪个子标签页：'active' (活跃中) 或 'archived' (已归档)
    let currentSubTab = 'active';

    if (!appData.config.apiKey && localStorage.getItem('tumblr_api_key')) {
        appData.config.apiKey = localStorage.getItem('tumblr_api_key');
        saveDataToStorage();
    }

    apiKeyInput.value = appData.config.apiKey;

    function saveDataToStorage() {
        localStorage.setItem('tumblr_manager_data', JSON.stringify(appData));
    }

    // === 路由切页逻辑 ===
    function switchView(activeNav, activeView) {
        [navDashboard, navDetail, navSettings].forEach(nav => nav.classList.remove('active'));
        [dashboardView, detailView, settingsView].forEach(view => view.style.display = 'none');
        activeNav.classList.add('active');
        activeView.style.display = 'flex';
        statusArea.innerText = "就绪";
        statusArea.style.color = "#666";
    }

    navDashboard.addEventListener('click', () => { switchView(navDashboard, dashboardView); renderBlogList(); });
    navDetail.addEventListener('click', () => switchView(navDetail, detailView));
    navSettings.addEventListener('click', () => switchView(navSettings, settingsView));

    // 子标签页切换监听
    subTabActive.addEventListener('click', () => {
        currentSubTab = 'active';
        subTabActive.classList.add('active');
        subTabArchived.classList.remove('active');
        renderBlogList();
    });
    subTabArchived.addEventListener('click', () => {
        currentSubTab = 'archived';
        subTabArchived.classList.add('active');
        subTabActive.classList.remove('active');
        renderBlogList();
    });

    // === 设置页面逻辑 ===
    btnSaveSettings.addEventListener('click', () => {
        appData.config.apiKey = apiKeyInput.value.trim();
        saveDataToStorage();
        statusArea.innerText = "⚙️ 配置保存成功！";
        statusArea.style.color = "green";
    });

    // === 渲染仪表盘已下载博客列表 ===
    function renderBlogList() {
        const container = document.getElementById('blogListContainer');
        const keys = Object.keys(appData.trackedBlogs);
        
        chkSelectAll.checked = false;

        // 1. 实时统计活跃数和归档数
        let activeNum = 0;
        let archivedNum = 0;
        keys.forEach(domain => {
            if (appData.trackedBlogs[domain].isArchived) { archivedNum++; } else { activeNum++; }
        });
        countActive.innerText = activeNum;
        countArchived.innerText = archivedNum;

        if (keys.length === 0) {
            container.innerHTML = '<div class="empty-tip">暂无下载记录，请前往“单博客下载”添加</div>';
            return;
        }

        // 2. 根据当前选中的子标签，过滤出需要展示的博客
        const filteredKeys = keys.filter(domain => {
            const isArchived = !!appData.trackedBlogs[domain].isArchived;
            return currentSubTab === 'archived' ? isArchived : !isArchived;
        });

        if (filteredKeys.length === 0) {
            container.innerHTML = `<div class="empty-tip">该分类下空空如也~</div>`;
            return;
        }

        container.innerHTML = '';
        filteredKeys.forEach(domain => {
            const blog = appData.trackedBlogs[domain];
            const card = document.createElement('div');
            card.className = 'blog-card';
            card.innerHTML = `
                <div class="blog-card-left">
                    <input type="checkbox" class="blog-select" data-domain="${domain}">
                    <div>
                        <div style="font-weight:bold; cursor:pointer;" class="blog-title-link" data-domain="${domain}">${blog.title}</div>
                        <div class="blog-card-meta">上次下载: ${blog.lastDownloadTime || '未记录'} (本地计数量: ${blog.totalPosts}条)</div>
                    </div>
                </div>
                <div class="blog-card-right">
                    ${blog.newPostsFound > 0 ? `<span class="badge">+${blog.newPostsFound}</span>` : ''}
                    <button class="btn-mini btn-archive" data-domain="${domain}" title="${blog.isArchived ? '移出归档（重新关注）' : '移入归档（丢进小黑屋）'}">
                        ${blog.isArchived ? '📤' : '📦'}
                    </button>
                    <button class="btn-mini btn-delete" data-domain="${domain}" title="从本地完全抹去这条记录">❌</button>
                </div>
            `;
            container.appendChild(card);
        });

        // === 绑定卡片内部的单体操作事件 ===
        
        // 联动：点击标题直达详情页
        container.querySelectorAll('.blog-title-link').forEach(link => {
            link.addEventListener('click', (e) => {
                const domain = e.target.getAttribute('data-domain');
                blogInput.value = domain.split('.')[0];
                switchView(navDetail, detailView);
                actionBtn.click();
            });
        });

        // 动作：点击归档/取消归档
        container.querySelectorAll('.btn-archive').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const domain = btn.getAttribute('data-domain');
                const blog = appData.trackedBlogs[domain];
                blog.isArchived = !blog.isArchived; // 状态取反
                if (blog.isArchived) blog.newPostsFound = 0; // 归档时自动清除未读红点
                saveDataToStorage();
                renderBlogList(); // 重新刷新列表视图
                statusArea.innerText = `已将 [${blog.title}] ${blog.isArchived ? '移入归档列表' : '恢复到活跃列表'}`;
                statusArea.style.color = "#007aff";
            });
        });

        // 动作：点击彻底删除记录
        container.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const domain = btn.getAttribute('data-domain');
                const blog = appData.trackedBlogs[domain];
                
                if (confirm(`确定要彻底删除 [${blog.title}] 的下载记录吗？\n（这不会删除 Eagle 里的图片，但会抹除该博客的上次下载时间断点信息）`)) {
                    delete appData.trackedBlogs[domain];
                    saveDataToStorage();
                    renderBlogList();
                    statusArea.innerText = `已彻底删除 [${blog.title}] 的跟踪记录。`;
                    statusArea.style.color = "orange";
                }
            });
        });

        // 联动：子多选框影响全选主键
        container.querySelectorAll('.blog-select').forEach(cb => {
            cb.addEventListener('change', () => {
                const allCheckboxes = container.querySelectorAll('.blog-select');
                const checkedCount = container.querySelectorAll('.blog-select:checked').length;
                chkSelectAll.checked = (checkedCount === allCheckboxes.length);
            });
        });
    }

    chkSelectAll.addEventListener('change', () => {
        const isChecked = chkSelectAll.checked;
        document.querySelectorAll('.blog-list .blog-select').forEach(cb => {
            cb.checked = isChecked;
        });
    });

    // === 批量检查更新 ===
    btnCheckUpdates.addEventListener('click', async () => {
        const selectedCbs = document.querySelectorAll('.blog-list .blog-select:checked');
        if (selectedCbs.length === 0) {
            statusArea.innerText = "提示：请先勾选需要检查更新的博客！";
            statusArea.style.color = "orange";
            return;
        }

        const apiKey = appData.config.apiKey;
        if (!apiKey) {
            statusArea.innerText = "错误：请先前往【设置】页面配置 API Key！";
            statusArea.style.color = "red";
            return;
        }

        statusArea.innerText = `🔄 开始批量检查 ${selectedCbs.length} 个博客...`;
        statusArea.style.color = "#007aff";
        btnCheckUpdates.disabled = true;

        let updatedCount = 0;

        for (let cb of selectedCbs) {
            const domain = cb.getAttribute('data-domain');
            const blog = appData.trackedBlogs[domain];
            statusArea.innerText = `🔍 正在线上对账: ${blog.title}...`;

            try {
                const infoUrl = `https://api.tumblr.com/v2/blog/${domain}/info?api_key=${apiKey}`;
                const response = await fetch(infoUrl);
                const result = await response.json();

                if (result.meta && result.meta.status === 200) {
                    const apiPosts = result.response.blog.posts;
                    if (apiPosts > blog.totalPosts) {
                        blog.newPostsFound = apiPosts - blog.totalPosts;
                        updatedCount++;
                    } else {
                        blog.newPostsFound = 0;
                    }
                    blog.totalPosts = apiPosts;
                }
            } catch (err) {
                console.error(`检查 ${domain} 失败:`, err);
            }
        }

        saveDataToStorage();
        renderBlogList();
        statusArea.innerText = `✅ 检查完毕！发现 ${updatedCount} 个博客有新帖子。`;
        statusArea.style.color = "green";
        btnCheckUpdates.disabled = false;
    });

    // === 一键追更新（增量雷达下载） ===
    const timeout = (ms) => new Promise((_, reject) => setTimeout(() => reject(new Error(`连接超时 (${ms / 1000}s)`)), ms));

    btnDownloadUpdates.addEventListener('click', async () => {
        const selectedCbs = document.querySelectorAll('.blog-list .blog-select:checked');
        if (selectedCbs.length === 0) {
            statusArea.innerText = "提示：请先勾选需要下载更新的博客！";
            statusArea.style.color = "orange";
            return;
        }

        const apiKey = appData.config.apiKey;
        const needPhoto = chkPhoto.checked;
        const needVideo = chkVideo.checked;

        statusArea.innerText = `🚀 启动批量增量同步引擎...`;
        statusArea.style.color = "#007aff";
        btnDownloadUpdates.disabled = true;

        try {
            for (let cb of selectedCbs) {
                const domain = cb.getAttribute('data-domain');
                const blog = appData.trackedBlogs[domain];
                const lastTimestamp = blog.lastDownloadTimestamp || 0;
                
                statusArea.innerText = `🔍 正在精准追踪 ${blog.title} 的新素材...`;

                let allMediaItems = [];
                let offset = 0;
                let hasMore = true;
                const limit = 50;
                let scanSessionNewestTimestamp = 0;

                while (hasMore) {
                    const apiUrl = `https://api.tumblr.com/v2/blog/${domain}/posts?api_key=${apiKey}&limit=${limit}&offset=${offset}`;
                    const response = await fetch(apiUrl);
                    const result = await response.json();

                    if (result.meta && result.meta.status !== 200) throw new Error(result.meta.msg || '抓取出错');

                    const posts = result.response.posts;
                    if (!posts || posts.length === 0) { hasMore = false; break; }

                    if (offset === 0 && posts[0]) {
                        scanSessionNewestTimestamp = posts[0].timestamp;
                    }

                    let reachedTimeLimit = false;
                    for (let post of posts) {
                        if (lastTimestamp && post.timestamp <= lastTimestamp) {
                            reachedTimeLimit = true;
                            hasMore = false;
                            break;
                        }

                        if (needPhoto && post.type === 'photo' && post.photos) {
                            post.photos.forEach(photo => {
                                if (photo.original_size && photo.original_size.url) {
                                    allMediaItems.push({ url: photo.original_size.url, source: post.post_url, caption: post.summary || domain.split('.')[0] });
                                }
                            });
                        }

                        if (needVideo && post.type === 'video' && post.video_url) {
                            allMediaItems.push({ url: post.video_url, source: post.post_url, caption: post.summary || `video_${post.id}` });
                        }
                    }

                    if (reachedTimeLimit) break;
                    offset += posts.length;
                    if (posts.length < limit) hasMore = false;
                }

                if (allMediaItems.length > 0) {
                    statusArea.innerText = `📥 [${blog.title}] 捕捉到 ${allMediaItems.length} 个全新资产，正在静默导入...`;
                    let successCount = 0;
                    
                    for (let i = 0; i < allMediaItems.length; i++) {
                        const item = allMediaItems[i];
                        try {
                            await Promise.race([
                                eagle.item.addFromURL(item.url, { name: item.caption, website: item.source, tags: ["Tumblr", domain.split('.')[0], "增量追更"] }),
                                timeout(15000)
                            ]);
                            successCount++;
                        } catch (err) {
                            console.warn(`⚠️ 增量素材跳过:`, err.message);
                        }
                    }
                    
                    blog.lastDownloadTime = new Date().toLocaleString('zh-CN');
                    if (scanSessionNewestTimestamp) {
                        blog.lastDownloadTimestamp = scanSessionNewestTimestamp;
                    }
                }

                blog.newPostsFound = 0;
                saveDataToStorage();
            }

            statusArea.innerText = `🎉 所有勾选的博客已完成增量同步！`;
            statusArea.style.color = "green";
            renderBlogList();

        } catch (error) {
            console.error(error);
            statusArea.innerText = `批量增量同步中途崩溃: ${error.message}`;
            statusArea.style.color = "red";
        } finally {
            btnDownloadUpdates.disabled = false;
        }
    });

    // === 现有核心逻辑：获取单盘概览 ===
    let targetBlogId = '';
    actionBtn.addEventListener('click', async () => {
        const apiKey = appData.config.apiKey;
        let blogId = blogInput.value.trim();
        
        if (!apiKey) {
            statusArea.innerText = "错误：请先前往【设置】页面配置 API Key！";
            statusArea.style.color = "red";
            return;
        }
        if (!blogId) {
            statusArea.innerText = "错误：请输入 Blog 域名！";
            statusArea.style.color = "red";
            return;
        }

        if (!blogId.includes('.')) { blogId = `${blogId}.tumblr.com`; }
        targetBlogId = blogId;

        statusArea.innerText = `正在读取博客概览...`;
        statusArea.style.color = "#007aff";
        overviewPanel.style.display = 'none';

        try {
            const infoUrl = `https://api.tumblr.com/v2/blog/${blogId}/info?api_key=${apiKey}`;
            const response = await fetch(infoUrl);
            const result = await response.json();

            if (result.meta && result.meta.status !== 200) throw new Error(result.meta.msg || '无法获取博客信息');

            const blogInfo = result.response.blog;
            const updateDate = new Date(blogInfo.updated * 1000).toLocaleString('zh-CN');

            infoTitle.innerText = blogInfo.title || blogInfo.name;
            infoTotal.innerText = blogInfo.posts;
            infoUpdated.innerText = updateDate;

            overviewPanel.style.display = 'block';
            statusArea.innerText = "概览获取成功！请确认筛选条件。";
            statusArea.style.color = "green";

            if (!appData.trackedBlogs[blogId]) {
                appData.trackedBlogs[blogId] = {
                    title: blogInfo.title || blogInfo.name,
                    totalPosts: blogInfo.posts,
                    lastDownloadTime: '',
                    lastDownloadTimestamp: 0,
                    newPostsFound: 0,
                    isArchived: false // ✨ 初始化默认非归档
                };
                saveDataToStorage();
            }

        } catch (error) {
            console.error(error);
            statusArea.innerText = `获取概览失败: ${error.message}`;
            statusArea.style.color = "red";
        }
    });

    // === 现有核心逻辑：单盘全量下载 ===
    downloadBtn.addEventListener('click', async () => {
        const apiKey = appData.config.apiKey;
        const needPhoto = chkPhoto.checked;
        const needVideo = chkVideo.checked;
        const filterDateStr = dateInput.value;
        
        let targetTimestamp = 0;
        if (filterDateStr) {
            targetTimestamp = Math.floor(new Date(filterDateStr).getTime() / 1000);
        }

        statusArea.innerText = `🚀 开始扫描符合条件的媒体文件...`;
        statusArea.style.color = "#007aff";
        downloadBtn.disabled = true;

        let allMediaItems = [];
        let offset = 0;
        let hasMore = true;
        const limit = 50;
        let scanSessionNewestTimestamp = 0;

        try {
            while (hasMore) {
                statusArea.innerText = `🔍 正在扫描第 ${offset + 1} 条之后的帖子...`;
                const apiUrl = `https://api.tumblr.com/v2/blog/${targetBlogId}/posts?api_key=${apiKey}&limit=${limit}&offset=${offset}`;
                const response = await fetch(apiUrl);
                const result = await response.json();

                if (result.meta && result.meta.status !== 200) throw new Error(result.meta.msg || '抓取出错');

                const posts = result.response.posts;
                if (!posts || posts.length === 0) { hasMore = false; break; }

                if (offset === 0 && posts[0]) {
                    scanSessionNewestTimestamp = posts[0].timestamp;
                }

                let reachedTimeLimit = false;
                for (let post of posts) {
                    if (targetTimestamp && post.timestamp < targetTimestamp) {
                        reachedTimeLimit = true;
                        hasMore = false;
                        break; 
                    }

                    if (needPhoto && post.type === 'photo' && post.photos) {
                        post.photos.forEach(photo => {
                            if (photo.original_size && photo.original_size.url) {
                                allMediaItems.push({ url: photo.original_size.url, source: post.post_url, caption: post.summary || targetBlogId.split('.')[0] });
                            }
                        });
                    }

                    if (needVideo && post.type === 'video' && post.video_url) {
                        allMediaItems.push({ url: post.video_url, source: post.post_url, caption: post.summary || `video_${post.id}` });
                    }
                }

                if (reachedTimeLimit) break;
                offset += posts.length;
                if (posts.length < limit) hasMore = false;
            }

            if (allMediaItems.length === 0) {
                statusArea.innerText = "⌛ 没有找到符合条件的素材。";
                statusArea.style.color = "orange";
                return;
            }

            let successCount = 0;
            for (let i = 0; i < allMediaItems.length; i++) {
                const item = allMediaItems[i];
                statusArea.innerText = `📥 正在导入入库: ${i + 1} / ${allMediaItems.length}`;
                try {
                    await Promise.race([
                        eagle.item.addFromURL(item.url, { name: item.caption, website: item.source, tags: ["Tumblr", targetBlogId.split('.')[0]] }),
                        timeout(15000)
                    ]);
                    successCount++;
                } catch (err) {
                    console.warn(`⚠️ 素材跳过:`, err.message);
                }
            }

            if (successCount > 0 && appData.trackedBlogs[targetBlogId]) {
                appData.trackedBlogs[targetBlogId].lastDownloadTime = new Date().toLocaleString('zh-CN');
                if (!filterDateStr && scanSessionNewestTimestamp) {
                    appData.trackedBlogs[targetBlogId].lastDownloadTimestamp = scanSessionNewestTimestamp;
                } else if (filterDateStr) {
                    appData.trackedBlogs[targetBlogId].lastDownloadTimestamp = Math.max(appData.trackedBlogs[targetBlogId].lastDownloadTimestamp, targetTimestamp);
                }
                appData.trackedBlogs[targetBlogId].newPostsFound = 0;
                saveDataToStorage();
            }

            statusArea.innerText = `🎉 成功同步 ${successCount} 个素材到 Eagle！`;
            statusArea.style.color = "green";

        } catch (error) {
            console.error(error);
            statusArea.innerText = `出错: ${error.message}`;
            statusArea.style.color = "red";
        } finally {
            downloadBtn.disabled = false;
        }
    });

    renderBlogList();
});