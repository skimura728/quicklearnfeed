document.addEventListener("DOMContentLoaded", () => {
    const container = document.getElementById("categories-container");
    const newsDetailContainer = document.getElementById("news-detail-container");
    let categories = [];
    let currentCategoryIndex = 0;
    let currentItemIndex = 0;
    let externalWindow = null;
    let viewingDetail = false;
    let requestTimeout = null;
    let currentFocusIndex = null;
    let isDataLoaded = false;    

    document.getElementById('top-bar').blur();

    fetch('/api/categories')
        .then(response => response.json())
        .then(categoryList => {
	    categories = categoryList;

	    //各カテゴリごとにニュースを取得
	    let categoryPromises = categoryList.map(category => {
		return fetch(`/api/news/${category}`)
		    .then(response => response.json())
		    .then(newsArray => {
			const categoryDiv = document.createElement("div");
			categoryDiv.classList.add("category");
			categoryDiv.innerHTML = `<h2>${category}</h2>`; // カテゴリタイトル

			const grid = document.createElement("div");
			grid.classList.add("news-grid");

			//各カテゴリに記事を追加
			newsArray.forEach((news, index) => {
			    const item = document.createElement("div");
			    item.classList.add("news-item");
			    item.tabIndex = -1; // disable tab 
			    item.dataset.link = news.link;
			    item.dataset.index = index;

			    // サムネイル画像（ダミー画像を使用）
			    const thumbnail = document.createElement("img");
			    thumbnail.src = news.thumbnail;
			    thumbnail.alt = `Thumbnail for ${news.title}`;
			    
			    // タイトル
			    const title = document.createElement("h3");
			    title.textContent = news.title;
			    title.style.fontSize="10px";
		    
			    // 日付（現在の日付を自動設定）
			    const date = document.createElement("p");
			    date.textContent = news.published;
			    date.style.fontSize="8px";

			    //タイルをカテゴリに追加
			    item.appendChild(thumbnail);
			    item.appendChild(title);
			    item.appendChild(date);
			    grid.appendChild(item);
			});

			//カテゴリをコンテナに追加
			categoryDiv.appendChild(grid);
			container.appendChild(categoryDiv);
		    })
		    .catch(error => console.error("エラー:", error));
	    });
			
	    //初期フォーカス設定
	    Promise.all(categoryPromises).then(() => {
		setInitialFocus();
		isDataLoaded = true;
		console.log("All categories loaded successfully");
	    });
	})
        .catch(error => console.error("カテゴリ取得エラー:", error));
			    
    function setInitialFocus() {
	const firstItem = container.querySelector(".news-item");
	if (firstItem){
	    firstItem.classList.add("focused");
	    firstItem.focus();
	    currentFocusIndex = firstItem.dataset.index; //最初のインデックスを保持
	    fetchSummary(firstItem);
	}
    }
	        
    document.addEventListener("keydown", (event) => {
	if (!isDataLoaded){
            console.warn("Key pressed before data load:", event.key);
            return;
	}
	event.preventDefault();

	let categories = document.querySelectorAll(".category");
	let currentCategory = categories[currentCategoryIndex];
	let currentItems = currentCategory.querySelectorAll(".news-item");

	switch (event.key) {
	case "ArrowRight": // 右キー（次のタイル）
	    console.log ("ArrowRight");
            if (currentItemIndex < currentItems.length - 1) {
		updateFocus(currentItemIndex + 1, currentCategoryIndex);
	    }
            break;
	case "ArrowLeft": // 左キー（前のタイル）
	    console.log ("ArrowLeft");
            if (currentItemIndex > 0) {
		updateFocus(currentItemIndex - 1, currentCategoryIndex);
            }
            break;
	case "ArrowDown": // 下キー（次のカテゴリ）
	    console.log ("ArrowDown");
            if (currentCategoryIndex < categories.length - 1) {
		updateFocus(0, currentCategoryIndex + 1);
            }
            break;
	case "ArrowUp": // 上キー（前のカテゴリ）
	    console.log ("ArrowUp");
            if (currentCategoryIndex > 0) {
		updateFocus(0, currentCategoryIndex - 1);
            }
            break;
	case "Enter": // Enterキー (記事詳細)
	    showDetail(currentItems[currentItemIndex]);
	    break;
	}
    });

    // フォーカスの更新
    function updateFocus(newItemIndex, newCategoryIndex) {
	let categories = document.querySelectorAll(".category");
        let currentCategory = categories[currentCategoryIndex];
        let newCategory = categories[newCategoryIndex];
        let currentItems = currentCategory.querySelectorAll(".news-item");
        let newItems = newCategory ? newCategory.querySelectorAll(".news-item") : [];

	if (!newCategory) {
             console.warn(`Invalid category index: ${newCategoryIndex}`);
             return; // ここでフォーカス更新せず終了
	 }

	if (newItems.length === 0) {
            console.warn(`No items found in category ${newCategoryIndex}`);
            return; // アイテムがない場合も終了
	}

	if (newItemIndex >= newItems.length || newItemIndex < 0) {
            console.warn(`Item index out of range: ${newItemIndex}`);
            return;
	}

        if (currentItems[currentItemIndex]) {
            currentItems[currentItemIndex].classList.remove("focused");
        }
        if (newItems[newItemIndex]) {
            newItems[newItemIndex].classList.add("focused");
            newItems[newItemIndex].focus();

	    // フォーカスが当たったタイルが見切れないようにスクロール
            newItems[newItemIndex].scrollIntoView({
		behavior: 'smooth', // スムーズにスクロール
		block: 'nearest',   // 最寄のスクロール位置に合わせる
		inline: 'center'    // タイルが中央にくるようにスクロール

            });

	    // 概要も更新
	    currentFocusIndex = newItems[newItemIndex].dataset.index;
	    fetchSummary(newItems[newItemIndex]);
	}

        currentItemIndex = newItemIndex;
        currentCategoryIndex = newCategoryIndex;
    }

    function showDetail(item) {
        const link = item.dataset.link;
        if (!link) return;

	console.log(link);

        viewingDetail = true;
        container.style.display = "none";
        newsDetailContainer.style.display = "block";
	newsDetailContainer.innerHTML = `
          <div class="modal">
            <div class="modal-content">
            <button id="close-modal">戻る</button>
            <p>外部リンクを開いてます...</p>
            </dvi>
　　　　　</div>
        `;

	externalWindow = window.open(link, "_blank");
	
	document.getElementById("close-modal").addEventListener("click", backToList);

    }

    // キーイベントを監視
    document.addEventListener("keydown", (event) => {
	event.preventDefault();
	if (event.key === "Backspace" || event.key === "ArrowLeft") {
	    if (viewingDetail) {
		event.preventDefault();
		backToList();
	    }else{
		closeResult();
	    }
	}
    });

    function backToList() {
	console.log ("backToList");
	if(externalWindow && !externalWindow.closed){
	    externalWindow.close();
	}
        viewingDetail = false;
        container.style.display = "block";
        newsDetailContainer.style.display = "none";
    }

    // resultを閉じる関数
    function closeResult() {
      document.getElementById("result").style.display = "none";
      document.body.style.marginRight = "0"; // 右側の領域を元に戻す
    }

    // Abstruct取得の遅延処理
    function fetchSummary(item) {

	clearTimeout(requestTimeout); //前回のリクエストをキャンセル
	requestTimeout = setTimeout(() => {
	    const link = item.dataset.link;
	    const title = item.querySelector("h3").textContent;

            // /api/scrapeを呼び出して記事の要約を取得
            fetch(`/api/scrape?url=${encodeURIComponent(link)}`)
		.then(response => response.json())
		.then(data => {
                if (data.summary && currentFocusIndex === item.dataset.index) {

		    console.log("Title:", title);
		    console.log("Abstruct:", data.summary);

		    // タイトルと概要を画面上部に表示
                    const topBar = document.getElementById("top-bar");
                    const titleElement = document.getElementById("title");
                    const summaryElement = document.getElementById("summary");

		    //既存の内容をクリア
		    titleElement.textContent = '';
		    summaryElement.textContent ='';

                    titleElement.textContent = `Title: ${title}`;
		    summaryElement.textContent = `Abstruct:${data.summary}`;

                    topBar.appendChild(titleElement);
                    topBar.appendChild(summaryElement);

                    // 画面上部に追加
                    document.body.appendChild(topBar);
                }
            })
            .catch(error => {
                console.error("記事の要約取得エラー:", error);
            });
	}, 500);
    }

    ["title","summary"].forEach(id =>{
	const element = document.getElementById(id);
	if (element){
	    element.addEventListener("mouseup", async () => {
		const selectedText = window.getSelection().toString().trim();
		if (selectedText &&  /^[a-zA-Z]+$/.test(selectedText)) {
		    // APIで単語の意味を取得
		    const apiUrl = `https://api.dictionaryapi.dev/api/v2/entries/en/${selectedText}`;

		    try {
			const response = await fetch(apiUrl);
			if (!response.ok) {
			    throw new Error("Word not found");
			}

			const data = await response.json();
			const meanings = data[0]?.meanings?.[0]?.definitions?.[0]?.definition;
			// 結果エリアに意味を表示
			document.getElementById("definition").innerHTML =
			    `<strong>${selectedText}:</strong> ${meanings || "No definition found"}`;

			// resultエリアを表示
			document.getElementById("result").style.display = "block";
			document.body.style.marginRight = "300px"; // 右側の領域を広げる

		    } catch (error) {
			document.getElementById("definition").innerHTML =
			    `<strong>${selectedText}:</strong> Meaning not found.`;

			document.getElementById("result").style.display = "block";
			document.body.style.marginRight = "300px"; // 右側の領域を広げる
		    }
		}
	    });
	}
    });
});
