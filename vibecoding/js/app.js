// Инициализация Telegram WebApp API
const tg = window.Telegram ? window.Telegram.WebApp : null;

if (tg) {
    tg.ready();
    tg.expand(); // Разворачиваем на весь экран
}

// Состояние приложения
let cart = [];
let currentCategory = 'all';
let searchQuery = '';
let isCheckoutStep = false;

// DOM-элементы
const catalogGrid = document.getElementById('catalog-grid');
const searchInput = document.getElementById('search-input');
const categoryButtons = document.querySelectorAll('.cat-btn');
const headerCartCount = document.getElementById('header-cart-count');
const cartOpenBtn = document.getElementById('cart-open-btn');
const cartDrawer = document.getElementById('cart-drawer');
const closeCartDrawerBtn = document.getElementById('close-cart-drawer');
const cartItemsList = document.getElementById('cart-items-list');
const cartTotalPrice = document.getElementById('cart-total-price');
const checkoutForm = document.getElementById('checkout-form');
const fallbackCheckoutBtn = document.getElementById('fallback-checkout-btn');
const productModal = document.getElementById('product-modal');
const closeProductModalBtn = document.getElementById('close-product-modal');
const modalBody = document.getElementById('modal-body');
const toast = document.getElementById('toast');

// Приветствие пользователя из Telegram
function initUser() {
    if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) {
        const user = tg.initDataUnsafe.user;
        document.getElementById('user-greeting').textContent = `Привет, ${user.first_name}! Доставка за 30 мин`;
    }
}

// Виброотклик (Haptic Feedback) в Telegram
function hapticImpact(style = 'light') {
    if (tg && tg.HapticFeedback) {
        tg.HapticFeedback.impactOccurred(style);
    }
}

// Показать всплывающее уведомление
function showToast(message) {
    toast.textContent = message;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 2000);
}

// Рендер каталога
function renderCatalog() {
    catalogGrid.innerHTML = '';
    const filtered = PRODUCTS.filter(item => {
        const matchesCat = currentCategory === 'all' || item.category === currentCategory;
        const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              item.description.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCat && matchesSearch;
    });

    if (filtered.length === 0) {
        catalogGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--hint-color); padding: 20px;">Ничего не найдено 😔</p>';
        return;
    }

    filtered.forEach(product => {
        const defaultSize = Object.keys(product.prices)[0];
        const startPrice = product.prices[defaultSize];

        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <div>
                <div class="card-img">
                    <img src="${product.image}" alt="${product.name}">
                </div>
                <div class="card-title">${product.name}</div>
                <div class="card-desc">${product.description}</div>
            </div>
            <div class="card-footer">
                <span class="card-price">${product.isPizza ? 'от ' : ''}${startPrice} ₽</span>
                <button class="add-btn">+ Выбрать</button>
            </div>
        `;
        card.addEventListener('click', () => openProductModal(product));
        catalogGrid.appendChild(card);
    });
}

// Модальное окно товара с выбором размера
function openProductModal(product) {
    hapticImpact('light');
    const sizes = Object.keys(product.prices);
    let selectedSize = sizes[0];

    function renderModalContent() {
        const price = product.prices[selectedSize];
        modalBody.innerHTML = `
            <div style="text-align: center; margin-bottom: 12px;">
                <img src="${product.image}" alt="${product.name}" style="width: 130px; height: 130px;">
            </div>
            <h2 style="font-size: 20px; margin-bottom: 6px;">${product.name}</h2>
            <p style="font-size: 13px; color: var(--hint-color); margin-bottom: 14px;">${product.description}</p>
            <div style="font-size: 13px; font-weight: 600;">Выберите размер / объем:</div>
            <div class="size-options">
                ${sizes.map(size => `
                    <button class="size-btn ${size === selectedSize ? 'active' : ''}" data-size="${size}">
                        ${size}<br><small>${product.prices[size]} ₽</small>
                    </button>
                `).join('')}
            </div>
            <button id="modal-add-to-cart" class="primary-btn" style="margin-top: 10px;">
                Добавить за ${price} ₽
            </button>
        `;

        modalBody.querySelectorAll('.size-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                selectedSize = btn.dataset.size;
                hapticImpact('light');
                renderModalContent();
            });
        });

        document.getElementById('modal-add-to-cart').addEventListener('click', () => {
            addToCart(product, selectedSize, product.prices[selectedSize]);
            productModal.classList.add('hidden');
        });
    }

    renderModalContent();
    productModal.classList.remove('hidden');
}

// Добавление в корзину
function addToCart(product, size, price) {
    hapticImpact('medium');
    const existingIndex = cart.findIndex(i => i.id === product.id && i.size === size);
    if (existingIndex > -1) {
        cart[existingIndex].qty += 1;
    } else {
        cart.push({
            id: product.id,
            name: product.name,
            size: size,
            price: price,
            qty: 1
        });
    }
    updateCartUI();
    showToast(`«${product.name}» добавлена!`);
}

// Изменение количества
function changeQty(index, delta) {
    hapticImpact('light');
    cart[index].qty += delta;
    if (cart[index].qty <= 0) {
        cart.splice(index, 1);
    }
    if (cart.length === 0) {
        isCheckoutStep = false;
        checkoutForm.classList.add('hidden');
    }
    updateCartUI();
}

// Обновление интерфейса корзины и главной кнопки Telegram
function updateCartUI() {
    const totalCount = cart.reduce((sum, item) => sum + item.qty, 0);
    const totalSum = cart.reduce((sum, item) => sum + item.price * item.qty, 0);

    headerCartCount.textContent = totalCount;
    cartTotalPrice.textContent = `${totalSum} ₽`;

    // Рендер списка в корзине
    if (cart.length === 0) {
        cartItemsList.innerHTML = '<p style="text-align:center; color: var(--hint-color); padding: 24px 0;">Корзина пока пуста 🍕</p>';
        fallbackCheckoutBtn.style.display = 'none';
    } else {
        fallbackCheckoutBtn.style.display = 'block';
        cartItemsList.innerHTML = cart.map((item, idx) => `
            <div class="cart-item">
                <div class="cart-item-info">
                    <h4>${item.name}</h4>
                    <p>${item.size} • ${item.price} ₽</p>
                </div>
                <div class="qty-controls">
                    <button class="qty-btn" onclick="changeQty(${idx}, -1)">−</button>
                    <span>${item.qty}</span>
                    <button class="qty-btn" onclick="changeQty(${idx}, 1)">+</button>
                </div>
            </div>
        `).join('');
    }

    // Управление нативной кнопкой Telegram MainButton
    if (tg && tg.MainButton) {
        if (totalCount > 0) {
            tg.MainButton.setText(isCheckoutStep ? `Подтвердить заказ (${totalSum} ₽)` : `Корзина • ${totalSum} ₽`);
            tg.MainButton.show();
        } else {
            tg.MainButton.hide();
        }
    }

    fallbackCheckoutBtn.textContent = isCheckoutStep ? `Подтвердить заказ (${totalSum} ₽)` : 'Перейти к оформлению';
}

// Обработка оформления заказа и отправка данных боту
function handleCheckoutAction() {
    if (cart.length === 0) return;

    if (cartDrawer.classList.contains('hidden')) {
        cartDrawer.classList.remove('hidden');
        return;
    }

    if (!isCheckoutStep) {
        isCheckoutStep = true;
        checkoutForm.classList.remove('hidden');
        updateCartUI();
        return;
    }

    // Валидация формы
    const address = document.getElementById('delivery-address').value.trim();
    const phone = document.getElementById('delivery-phone').value.trim();
    const payment = document.getElementById('payment-method').value;
    const comment = document.getElementById('order-comment').value.trim();

    if (!address || !phone) {
        hapticImpact('heavy');
        alert('Пожалуйста, укажите адрес доставки и номер телефона!');
        return;
    }

    const totalSum = cart.reduce((sum, item) => sum + item.price * item.qty, 0);

    const orderPayload = {
        items: cart,
        total: totalSum,
        address: address,
        phone: phone,
        payment: payment,
        comment: comment
    };

    // Отправка данных обратно в Telegram Бота
    if (tg && tg.sendData) {
        tg.sendData(JSON.stringify(orderPayload));
    } else {
        // Fallback для тестирования в обычном браузере
        console.log('Order Payload:', orderPayload);
        alert(`Заказ оформлен!\nСумма: ${totalSum} ₽\nАдрес: ${address}\n(В Telegram эти данные улетят боту)`);
        cart = [];
        isCheckoutStep = false;
        checkoutForm.classList.add('hidden');
        cartDrawer.classList.add('hidden');
        updateCartUI();
    }
}

// Слушатели событий
searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderCatalog();
});

categoryButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        categoryButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentCategory = btn.dataset.category;
        hapticImpact('light');
        renderCatalog();
    });
});

cartOpenBtn.addEventListener('click', () => {
    hapticImpact('light');
    cartDrawer.classList.remove('hidden');
});

closeCartDrawerBtn.addEventListener('click', () => {
    cartDrawer.classList.add('hidden');
});

document.querySelector('.drawer-backdrop').addEventListener('click', () => {
    cartDrawer.classList.add('hidden');
});

closeProductModalBtn.addEventListener('click', () => {
    productModal.classList.add('hidden');
});

document.querySelector('.modal-backdrop').addEventListener('click', () => {
    productModal.classList.add('hidden');
});

fallbackCheckoutBtn.addEventListener('click', handleCheckoutAction);

if (tg && tg.MainButton) {
    tg.MainButton.onClick(handleCheckoutAction);
}

// Старт приложения
initUser();
renderCatalog();
updateCartUI();
