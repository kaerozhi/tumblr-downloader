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
    const tagInput = document.getElementById('tagInput');
    const statusArea = document.getElementById('statusArea');
    
    const overviewPanel = document.getElementById('overviewPanel');
    const infoTitle = document.getElementById('infoTitle');
    const infoTargetTag = document.getElementById('infoTargetTag');
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

    let currentSubTab = 'active';

    if (!appData.config.apiKey && localStorage.getItem('tumblr_api_key')) {
        appData.config.apiKey = localStorage.getItem('tumblr_api_key');
        saveDataToStorage();
    }

    apiKeyInput.value = appData.config.apiKey;

    function saveDataToStorage() {
        localStorage.setItem('tumblr_manager_data', JSON.stringify(appData));
    }

    // ✨ 智能解析工具函数：自动识别链接中的 blog 和 tag
    function parseTumblrInput(str) {
        let blog = str.trim();
        let tag = '';

        if (!blog) return { blog: '', tag: '' };

        try {
            if (blog.startsWith('http://') || blog.startsWith('https://')) {
                const urlObj = new URL(blog);
                const pathSegments = urlObj.pathname.split('/').filter(Boolean);

                if (urlObj.hostname === 'www.tumblr.com') {
                    if (pathSegments.length >= 1) blog = pathSegments[0];
                    if (pathSegments.length >= 3 && pathSegments[1] === 'tagged') {
                        tag = decodeURIComponent(pathSegments[2]);
                    }
                } else if (urlObj.hostname.endsWith('.tumblr.com')) {
                    blog = urlObj.hostname.replace('.tumblr.com', '');
                    if (pathSegments.length >= 2 && pathSegments[0] === 'tagged') {
                        tag = decodeURIComponent(pathSegments[1]);
                    }
                }
            } else if (blog.includes('/tagged/')) {
                const parts = blog.split('/tagged/');
                blog = parts[0].replace('www.tumblr.com/', '');
                tag = decodeURIComponent(parts[1]);
            }
        } catch (e) {
            console.warn("链接解析异常，回退到原始字符串:", e);
        }

        blog = blog.replace(/\/$/, '');
        if (blog.endsWith('.tumblr.com')) {
            blog = blog.replace('.tumblr.com', '');
        }

        return { blog, tag };
    }

    // 监听输入框动态解析
    blogInput.addEventListener('input', () => {
        const rawVal = blogInput.value.trim();
        if (rawVal.includes('/tagged/') || rawVal.startsWith('http')) {
            const { blog, tag } = parseTumblrInput(rawVal);
            if (blog) blogInput.value = blog;
            if (tag) tagInput.value = tag;
        }
    });

    // ✨ 核心全能媒体解析器（兼容 Legacy 格式、NPF 块格式、Reblog 转发链及嵌入 HTML）
    function extractMediaFromPost(post, needPhoto, needVideo) {
        const mediaItems = [];
        const addedUrls = new Set();

        function addUrl(url, type) {
            if (!url || addedUrls.has(url)) return;
            addedUrls.add(url);
            mediaItems.push({
                url: url,
                type: type,
                source: post.post_url || '',
                caption: post.summary || post.slug || `post_${post.id}`
            });
        }

        // 1. 检查 Legacy Photos 数组 (取消 post.type === 'photo' 限制)
        if (needPhoto && post.photos && Array.isArray(post.photos)) {
            post.photos.forEach(p => {
                if (p.original_size && p.original_size.url) {
                    addUrl(p.original_size.url, 'photo');
                }
            });
        }

        // 2. 检查 NPF (Neue Post Format) Content 内容块
        if (post.content && Array.isArray(post.content)) {
            post.content.forEach(block => {
                if (needPhoto && block.type === 'image' && block.media) {
                    const mediaList = Array.isArray(block.media) ? block.media : [block.media];
                    if (mediaList.length > 0) {
                        let maxMedia = mediaList[0];
                        for (let m of mediaList) {
                            if ((m.width || 0) > (maxMedia.width || 0)) maxMedia = m;
                        }
                        if (maxMedia && maxMedia.url) addUrl(maxMedia.url, 'photo');
                    }
                }
                if (needVideo && block.type === 'video') {
                    if (block.media && block.media.url) {
                        addUrl(block.media.url, 'video');
                    } else if (Array.isArray(block.media) && block.media[0] && block.media[0].url) {
                        addUrl(block.media[0].url, 'video');
                    }
                }
            });
        }

        // 3. 检查 Reblog Trail (转发历史轨迹)
        if (post.trail && Array.isArray(post.trail)) {
            post.trail.forEach(trailItem => {
                if (trailItem.content && Array.isArray(trailItem.content)) {
                    trailItem.content.forEach(block => {
                        if (needPhoto && block.type === 'image' && block.media) {
                            const mediaList = Array.isArray(block.media) ? block.media : [block.media];
                            if (mediaList.length > 0) {
                                let maxMedia = mediaList[0];
                                for (let m of mediaList) {
                                    if ((m.width || 0) > (maxMedia.width || 0)) maxMedia = m;
                                }
                                if (maxMedia && maxMedia.url) addUrl(maxMedia.url, 'photo');
                            }
                        }
                        if (needVideo && block.type === 'video' && block.media) {
                            const vUrl = block.media.url || (Array.isArray(block.media) && block.media[0] && block.media[0].url);
                            if (vUrl) addUrl(vUrl, 'video');
                        }
                    });
                }
            });
        }

        // 4. 检查 Legacy Video 字段
        if (needVideo) {
            if (post.video_url) addUrl(post.video_url, 'video');
            if (post.video_file_url) addUrl(post.video_file_url, 'video');
        }

        // 5. 兜底：抓取 HTML 正文/Caption 中的图片链接
        if (needPhoto && mediaItems.length === 0) {
            const htmlSources = [post.body, post.caption].filter(Boolean);
            htmlSources.forEach(html => {
                const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
                let match;
                while ((match = imgRegex.exec(html)) !== null) {
                    let imgUrl = match[1];
                    if (imgUrl.includes('tumblr.com') && !imgUrl.includes('avatar')) {
                        addUrl(imgUrl, 'photo');
                    }
                }
            });
        }

        return mediaItems;
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

    // === 渲染仪表盘列表 ===
    function renderBlogList() {
        const container = document.getElementById('blogListContainer');
        const keys = Object.keys(appData.trackedBlogs);
        
        chkSelectAll.checked = false;

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

        container.querySelectorAll('.blog-title-link').forEach(link => {
            link.addEventListener('click', (e) => {
                const domain = e.target.getAttribute('data-domain');
                blogInput.value = domain.split('.')[0];
                tagInput.value = '';
                switchView(navDetail, detailView);
                actionBtn.click();
            });
        });

        container.querySelectorAll('.btn-archive').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const domain = btn.getAttribute('data-domain');
                const blog = appData.trackedBlogs[domain];
                blog.isArchived = !blog.isArchived;
                if (blog.isArchived) blog.newPostsFound = 0;
                saveDataToStorage();
                renderBlogList();
                statusArea.innerText = `已将 [${blog.title}] ${blog.isArchived ? '移入归档列表' : '恢复到活跃列表'}`;
                statusArea.style.color = "#007aff";
            });
        });

        container.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const domain = btn.getAttribute('data-domain');
                const blog = appData.trackedBlogs[domain];
                if (confirm(`确定要彻底删除 [${blog.title}] 的下载记录吗？`)) {
                    delete appData.trackedBlogs[domain];
                    saveDataToStorage();
                    renderBlogList();
                    statusArea.innerText = `已彻底删除 [${blog.title}] 的跟踪记录。`;
                    statusArea.style.color = "orange";
                }
            });
        });

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

    // === 批量追更新 ===
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

                        const items = extractMediaFromPost(post, needPhoto, needVideo);
                        allMediaItems.push(...items);
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

    // === 获取单博客概览 ===
    let targetBlogId = '';
    let targetTag = '';

    actionBtn.addEventListener('click', async () => {
        const apiKey = appData.config.apiKey;
        const rawInput = blogInput.value.trim();
        const manualTag = tagInput.value.trim();
        
        if (!apiKey) {
            statusArea.innerText = "错误：请先前往【设置】页面配置 API Key！";
            statusArea.style.color = "red";
            return;
        }
        if (!rawInput) {
            statusArea.innerText = "错误：请输入 Blog 域名或粘贴 Tumblr URL！";
            statusArea.style.color = "red";
            return;
        }

        const parsed = parseTumblrInput(rawInput);
        let blogId = parsed.blog;
        targetTag = manualTag || parsed.tag;

        if (!blogId.includes('.')) { blogId = `${blogId}.tumblr.com`; }
        targetBlogId = blogId;

        if (targetTag) {
            tagInput.value = targetTag;
        }

        statusArea.innerText = `正在读取博客信息...`;
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
            infoUpdated.innerText = updateDate;

            if (targetTag) {
                infoTargetTag.innerText = `标签：#${targetTag}`;
                const tagCheckUrl = `https://api.tumblr.com/v2/blog/${blogId}/posts?api_key=${apiKey}&tag=${encodeURIComponent(targetTag)}&limit=1`;
                const tagRes = await fetch(tagCheckUrl);
                const tagResult = await tagRes.json();
                if (tagResult.response && tagResult.response.total_posts !== undefined) {
                    infoTotal.innerText = tagResult.response.total_posts;
                } else if (tagResult.response && tagResult.response.posts) {
                    infoTotal.innerText = `约 ${tagResult.response.posts.length > 0 ? '不少于 1' : '0'}`;
                } else {
                    infoTotal.innerText = "未知";
                }
            } else {
                infoTargetTag.innerText = "全部内容（未设 Tag）";
                infoTotal.innerText = blogInfo.posts;
            }

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
                    isArchived: false
                };
                saveDataToStorage();
            }

        } catch (error) {
            console.error(error);
            statusArea.innerText = `获取概览失败: ${error.message}`;
            statusArea.style.color = "red";
        }
    });

    // === 单博客全量/Tag 筛选下载 ===
    downloadBtn.addEventListener('click', async () => {
        const apiKey = appData.config.apiKey;
        const needPhoto = chkPhoto.checked;
        const needVideo = chkVideo.checked;
        const filterDateStr = dateInput.value;
        const currentTag = tagInput.value.trim() || targetTag;
        
        let targetTimestamp = 0;
        if (filterDateStr) {
            targetTimestamp = Math.floor(new Date(filterDateStr).getTime() / 1000);
        }

        statusArea.innerText = `🚀 开始扫描符合条件的素材${currentTag ? ` [Tag: #${currentTag}]` : ''}...`;
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
                
                let apiUrl = `https://api.tumblr.com/v2/blog/${targetBlogId}/posts?api_key=${apiKey}&limit=${limit}&offset=${offset}`;
                if (currentTag) {
                    apiUrl += `&tag=${encodeURIComponent(currentTag)}`;
                }

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

                    // ✨ 使用全能提取器解析图片/视频
                    const items = extractMediaFromPost(post, needPhoto, needVideo);
                    allMediaItems.push(...items);
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

            const eagleTags = ["Tumblr", targetBlogId.split('.')[0]];
            if (currentTag) eagleTags.push(currentTag);

            let successCount = 0;
            for (let i = 0; i < allMediaItems.length; i++) {
                const item = allMediaItems[i];
                statusArea.innerText = `📥 正在导入入库 (${i + 1}/${allMediaItems.length}): ${item.caption.slice(0, 15)}...`;
                try {
                    await Promise.race([
                        eagle.item.addFromURL(item.url, { name: item.caption, website: item.source, tags: eagleTags }),
                        timeout(15000)
                    ]);
                    successCount++;
                } catch (err) {
                    console.warn(`⚠️ 素材跳过:`, err.message);
                }
            }

            if (successCount > 0 && appData.trackedBlogs[targetBlogId]) {
                appData.trackedBlogs[targetBlogId].lastDownloadTime = new Date().toLocaleString('zh-CN');
                if (!filterDateStr && !currentTag && scanSessionNewestTimestamp) {
                    appData.trackedBlogs[targetBlogId].lastDownloadTimestamp = scanSessionNewestTimestamp;
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