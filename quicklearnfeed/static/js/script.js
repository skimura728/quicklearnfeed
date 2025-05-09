function sendAnalyticsEvent(eventName, params) {
    if (typeof gtag === 'function') {
        gtag('event', eventName, params);
    } else {
        console.warn("gtag not available");
    }
}

function logNewsTileClick(title, category) {
    sendAnalyticsEvent('news_tile_click', {
        title: title,
        category: category
    });
}

function logSummaryExpand(title, summary) {
    sendAnalyticsEvent('summary_expand', {
        title: title,
        summary: summary.substring(0, 100)
    });
}

function logDictionaryLookup(word) {
    sendAnalyticsEvent('dictionary_lookup', {
        word: word
    });
}

document.addEventListener("DOMContentLoaded", () => {
    // Register Service Worker
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/service-worker.js')
                .then(registration => {
                    console.log('Service Worker registered with scope:', registration.scope);
                })
                .catch(error => {
                    console.log('Service Worker registration failed:', error);
                });
        });
    }

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

	    //Fetch news by category
	    let categoryPromises = categoryList.map(category => {
		return fetch(`/api/news/${category}`)
		    .then(response => response.json())
		    .then(newsArray => {
			const categoryDiv = document.createElement("div");
			categoryDiv.classList.add("category");
			categoryDiv.innerHTML = `<h2>${category}</h2>`; // Category Title

			const grid = document.createElement("div");
			grid.classList.add("news-grid");

			//Add articles to each category
			newsArray.forEach((news, index) => {
			    const item = document.createElement("div");
			    item.classList.add("news-item");
			    item.tabIndex = -1; // disable tab 
			    item.dataset.link = news.link;
			    item.dataset.index = index;

			    // Thumbnail image
			    const thumbnail = document.createElement("img");
			    thumbnail.src = news.thumbnail;
			    thumbnail.alt = `Thumbnail for ${news.title}`;
			    
			    // Title
			    const title = document.createElement("h3");
			    title.textContent = news.title;
		    
			    // Publication date
			    const date = document.createElement("p");
			    date.textContent = news.published;
			    date.style.fontSize="8px";

			    //Add tile to category
			    item.appendChild(thumbnail);
			    item.appendChild(title);
			    item.appendChild(date);
			    grid.appendChild(item);
			});

			//Add category to container
			categoryDiv.appendChild(grid);
			container.appendChild(categoryDiv);
		    })
		    .catch(error => console.error("Error:", error));
	    });
			
	    //Initial focus setting
	    Promise.all(categoryPromises).then(() => {
		setInitialFocus();
		isDataLoaded = true;
		console.log("All categories loaded successfully");
	    });
	})
        .catch(error => console.error("Category fech error:", error));
			    
    function setInitialFocus() {
	const firstItem = container.querySelector(".news-item");
	if (firstItem){
	    firstItem.classList.add("focused");
	    firstItem.focus();
	    currentFocusIndex = firstItem.dataset.index; //Keep the initial index
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
	case "ArrowRight": // Right arrow key（next tile）
	    console.log ("ArrowRight");
            if (currentItemIndex < currentItems.length - 1) {
		updateFocus(currentItemIndex + 1, currentCategoryIndex);
	    }
            break;
	case "ArrowLeft": // Left arrow key（Previous tile）
	    console.log ("ArrowLeft");
            if (currentItemIndex > 0) {
		updateFocus(currentItemIndex - 1, currentCategoryIndex);
            }
            break;
	case "ArrowDown": // Down arrow key（Next category）
	    console.log ("ArrowDown");
            if (currentCategoryIndex < categories.length - 1) {
		updateFocus(0, currentCategoryIndex + 1);
            }
            break;
	case "ArrowUp": // Up arrow key（Previous category）
	    console.log ("ArrowUp");
            if (currentCategoryIndex > 0) {
		updateFocus(0, currentCategoryIndex - 1);
            }
            break;
	case "Enter": // Enter key (Article details)
	    showDetail(currentItems[currentItemIndex]);
	    break;
	}
    });

    // Focus update
    function updateFocus(newItemIndex, newCategoryIndex) {
	let categories = document.querySelectorAll(".category");
        let currentCategory = categories[currentCategoryIndex];
        let newCategory = categories[newCategoryIndex];
        let currentItems = currentCategory.querySelectorAll(".news-item");
        let newItems = newCategory ? newCategory.querySelectorAll(".news-item") : [];

	if (!newCategory) {
             console.warn(`Invalid category index: ${newCategoryIndex}`);
             return; // Exit without updating the focus
	 }

	if (newItems.length === 0) {
            console.warn(`No items found in category ${newCategoryIndex}`);
            return; // Exit even if there are no items
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

	    // Scroll to ensure the focused tile is fully visible
	    let topBarHeight = document.getElementById("top-bar").offsetHeight;
            let itemRect = newItems[newItemIndex].getBoundingClientRect();
            let containerRect = container.getBoundingClientRect();
            let offsetTop = itemRect.top - containerRect.top;
        
            if (itemRect.top < topBarHeight) {
		container.scrollBy({
                    top: offsetTop - topBarHeight,
                    behavior: "smooth"
		});
            } else if (itemRect.bottom > window.innerHeight) {
		container.scrollBy({
                    top: itemRect.bottom - window.innerHeight,
                    behavior: "smooth"
		});
            }

	    currentFocusIndex = newItems[newItemIndex].dataset.index;
	    // Update the summary
	    fetchSummary(newItems[newItemIndex]);
	}

        currentItemIndex = newItemIndex;
        currentCategoryIndex = newCategoryIndex;
    }

    container.addEventListener("mouseover", (event) => {
	const item = event.target.closest(".news-item");
	if (!item) return;

	const categories = document.querySelectorAll(".category");

	categories.forEach((category, catIdx) => {
            const items = category.querySelectorAll(".news-item");
            items.forEach((el, itemIdx) => {
		if (el === item) {
                    if (catIdx !== currentCategoryIndex || itemIdx !== currentItemIndex) {
			updateFocus(itemIdx, catIdx);
                    }
		}
            });
	});
    });

    //display article details on mouse click
    const isMobile = /iPhone|Android/.test(navigator.userAgent);

    if (!isMobile) {
	container.addEventListener("click", (event) => {
	    const item = event.target.closest(".news-item");
	    if (!item)
		return;
	    if (item.classList.contains("focused")) {
		showDetail(item);
	    }
	});
    }

    function showDetail(item) {
        const link = item.dataset.link;

        if (!link) return;

	const title = item.querySelector("h3")?.textContent || "Unknown";
	const categoryElement = item.closest(".category")?.querySelector("h2");
	const category = categoryElement ? categoryElement.textContent : "Unknown";
	logNewsTileClick(title, category)

	console.log(link);

        viewingDetail = true;
	if (isMobile){
	    window.location.href = link;
            return;
	}

        container.style.display = "none";
        newsDetailContainer.style.display = "block";
	newsDetailContainer.innerHTML = `
          <div class="modal">
            <div class="modal-content">
            <button id="close-modal">Back</button>
            <p>Opening an external link...</p>
            </div>
　　　　　</div>
        `;

	externalWindow = window.open(link, "_blank");
	
	document.getElementById("close-modal").addEventListener("click", backToList);

    }

    // Monitor key events
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

    //Close the article detail tab
    function backToList() {
	console.log ("backToList");
	if(externalWindow && !externalWindow.closed){
	    externalWindow.close();
	}
        viewingDetail = false;
        container.style.display = "block";
        newsDetailContainer.style.display = "none";
    }

    // Close the word definition area
    function closeResult() {
      document.getElementById("result").style.display = "none";
      document.body.style.marginRight = "0"; // Restore the right-side area
    }

    // Delay handling for summary retrieval
    function fetchSummary(item) {

	clearTimeout(requestTimeout); //Cancel the previous request
	requestTimeout = setTimeout(() => {
	    if (document.activeElement !== item){
		return; //If the focus is lost, not make the request
	    }
	    
	    const link = item.dataset.link;
	    const title = item.querySelector("h3").textContent;
		const maxlen = isMobile ? 100 : 200;

            // Retrieve the article summary
            fetch(`/api/scrape?url=${encodeURIComponent(link)}&maxlen=${maxlen}`)
		.then(response => response.json())
		.then(data => {
                if (data.summary && currentFocusIndex === item.dataset.index) {

		    console.log("Title:", title);
		    console.log("Summary:", data.summary);

		    // Display the title and summary at the top of the screen
                    const topBar = document.getElementById("top-bar");
                    const titleElement = document.getElementById("title");
                    const summaryElement = document.getElementById("summary");

		    // Clear existing content
		    titleElement.textContent = '';
		    summaryElement.textContent ='';

                    titleElement.textContent = `Title: ${title}`;
		    summaryElement.textContent = `Summary:${data.summary}`;

                    topBar.appendChild(titleElement);
                    topBar.appendChild(summaryElement);
                    document.body.appendChild(topBar);
		    const summary = data.summary ? data.summary : "Unknown"
		    logSummaryExpand(title, summary)
                }
            })
            .catch(error => {
                console.error("Article summary error:", error);
            });
	}, 1000);
    }

    function cancelSummaryRequest() {
	clearTimeout(requestTimeout);
    }

    const newsItems = document.querySelectorAll(".news-item");
    newsItems.forEach(item => {
	item.addEventListener("focus", () => fetchSummary(item));
	item.addEventListener("blur", cancelSummaryRequest);
    });

    ["title","summary"].forEach(id =>{
	const element = document.getElementById(id);
	if (element){
	    element.addEventListener("mouseup", async () => {
		const selectedText = window.getSelection().toString().trim();
		if (selectedText &&  /^[a-zA-Z]+$/.test(selectedText)) {

		    // Retrieve the meaning of a word
		    logDictionaryLookup(selectedText)
		    const apiUrl = `https://api.dictionaryapi.dev/api/v2/entries/en/${selectedText}`;

		    try {
			const response = await fetch(apiUrl);
			if (!response.ok) {
			    throw new Error("Word not found");
			}

			const data = await response.json();
			const meanings = data[0]?.meanings?.[0]?.definitions?.[0]?.definition;
			// Display the meaning in the result area
			document.getElementById("definition").innerHTML =
			    `<strong>${selectedText}:</strong> ${meanings || "No definition found"}`;

			// Display the result area
			document.getElementById("result").style.display = "block";
			document.body.style.marginRight = "300px"; // Expand both panals on the right side

		    } catch (error) {
			document.getElementById("definition").innerHTML =
			    `<strong>${selectedText}:</strong> Meaning not found.`;

			document.getElementById("result").style.display = "block";
			document.body.style.marginRight = "300px"; // Expand both panals on the right side
		    }
		}
	    });
	}
    });

    //for mobile
    //support tap event
    container.addEventListener("touchstart", handleFocusByPointer, { passive: true });
    function handleFocusByPointer(event) {
	const targetItem = event.target.closest(".news-item");
	if (targetItem) {
            const newCategoryDiv = targetItem.closest(".category");
            const newCategoryIndex = [...container.querySelectorAll(".category")].indexOf(newCategoryDiv);
            const newItemIndex = [...newCategoryDiv.querySelectorAll(".news-item")].indexOf(targetItem);
            updateFocus(newItemIndex, newCategoryIndex);
	}
    }

    //support double tap event
    let lastTapTime = 0;
    const doubleTapThreshold = 300; //Double tap within 300ms

    container.addEventListener("touchend", (e) => {
	const currentTime = new Date().getTime();
	const tapLength = currentTime - lastTapTime;

	const touchedItem = e.target.closest(".news-item");

	if (touchedItem && tapLength < doubleTapThreshold && tapLength > 0) {
            //Open article detail on double tap
            showDetail(touchedItem);
	}

	lastTapTime = currentTime;
    });
});
