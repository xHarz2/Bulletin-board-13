// Фреймворк: Vue 3 (через CDN). Обрано Vue, бо він підключається одним тегом <script>
// і не потребує Babel для JSX, а шаблони схожі на звичайний HTML.

// Адреса API з оголошеннями (JSONPlaceholder, мок-дані)
const API_URL = 'https://jsonplaceholder.typicode.com/posts?userId=3';

const DESCRIPTION_MAX = 200;

// Скільки мілісекунд нове оголошення має позначку "Нове" (3 с показ + 1 с згасання в CSS)
const NEW_BADGE_TIME = 4000;

// Модель збереженого оголошення: { id, title, category, description, date }
// id - число (Date.now()), date - рядок у форматі РРРР-ММ-ДД

// ----- localStorage -----

const LS_KEY = 'boardPosts';
const LS_MIGRATED_KEY = 'boardPostsMigrated';

// Зберігає масив оголошень у localStorage
function saveToLocalStorage(items) {
    localStorage.setItem(LS_KEY, JSON.stringify(items));
}

// Читає масив оголошень з localStorage (порожній масив, якщо даних немає або вони пошкоджені)
function loadFromLocalStorage() {
    try {
        const raw = localStorage.getItem(LS_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (error) {
        console.error('Пошкоджені дані в localStorage:', error);
        return [];
    }
}

// ----- IndexedDB -----

const DB_NAME = 'NeighborhoodBoardDB';
const DB_VERSION = 1;
const STORE_NAME = 'posts';

// Відкриває базу; при першому запуску створює сховище posts з ключем id
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// Додає оголошення (put також оновлює запис з тим самим id)
async function addItem(item) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(item);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

// Оновлення наявного оголошення - той самий put з тим самим id
async function updateItem(item) {
    return addItem(item);
}

// Повертає всі оголошення зі сховища
async function getAllItems() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const request = tx.objectStore(STORE_NAME).getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// Видаляє оголошення за id
async function deleteItem(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

// Одноразове перенесення даних з localStorage в IndexedDB
async function migrateFromLocalStorage() {
    if (localStorage.getItem(LS_MIGRATED_KEY) === 'true') {
        return;
    }

    const stored = await getAllItems();
    const oldItems = loadFromLocalStorage();

    if (stored.length === 0 && oldItems.length > 0) {
        for (const item of oldItems) {
            await addItem(item);
        }
        // Позначаємо, що міграцію виконано, щоб не повторювати її
        localStorage.setItem(LS_MIGRATED_KEY, 'true');
        console.log(`Перенесено з localStorage в IndexedDB: ${oldItems.length}`);
    }
}

// Скільки днів минуло від дати публікації
function daysSince(dateString) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const date = new Date(dateString + 'T00:00:00');
    return Math.round((today - date) / (1000 * 60 * 60 * 24));
}

// Сьогоднішня дата у форматі РРРР-ММ-ДД
function todayString() {
    const d = new Date();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${month}-${day}`;
}

// Функцію renderAds() з практичної №7 видалено: список тепер рендерить
// компонент AdCard через v-for, без createElement та innerHTML.


// Компонент картки оголошення.
// У стрічці показує скорочений заголовок-посилання і кнопку "Показати деталі",
// на сторінці /posts/:id (detailed) - повний заголовок і весь опис
const AdCard = {
    props: {
        id: Number,
        title: String,
        category: String,
        description: String,
        daysAgo: Number,
        deletable: Boolean,
        isNew: Boolean,
        detailed: Boolean
    },
    emits: ['delete'],
    data() {
        // Локальний прапорець: чи розгорнуто опис
        return { expanded: false };
    },
    computed: {
        // Заголовок, скорочений до 30 символів
        shortTitle() {
            return this.title.length > 30 ? this.title.slice(0, 30) + '...' : this.title;
        },
        // Клас бейджа залежно від категорії
        badgeClass() {
            const classes = {
                'Речі': 'badge-items',
                'Послуги': 'badge-services',
                'Тварини': 'badge-animals',
                'З мережі': 'badge-online'
            };
            return classes[this.category] || '';
        },
        imgSrc() {
            const imgText = this.title.split(' ')[0];
            return `https://placehold.co/400x200/EEE/31343C?text=${imgText}`;
        },
        // Посилання на сторінку деталей
        detailLink() {
            return `#/posts/${this.id}`;
        }
    },
    template: `
        <article class="card" :class="{ outdated: daysAgo > 14, 'card--new': isNew, 'card--detailed': detailed }">
            <div class="card-badges">
                <span class="badge" :class="badgeClass">{{ category }}</span>
                <span v-if="isNew" class="badge badge-new">Нове</span>
            </div>

            <h2 v-if="detailed">{{ title }}</h2>
            <h3 v-else><a :href="detailLink" data-link>{{ shortTitle }}</a></h3>

            <img :src="imgSrc" :alt="title">

            <div class="card-actions">
                <button v-if="description && !detailed" type="button" class="btn-details" @click="expanded = !expanded">
                    {{ expanded ? 'Сховати деталі' : 'Показати деталі' }}
                </button>
                <button v-if="deletable" type="button" class="btn-delete" @click="$emit('delete', id)">
                    Видалити
                </button>
            </div>
            <p v-if="description && (expanded || detailed)" class="card-description">{{ description }}</p>

            <p v-if="daysAgo !== undefined">Опубліковано днів тому: {{ daysAgo }}</p>
        </article>
    `
};

// Компонент форми нового оголошення (логіка з практичної №8)
const NewAdForm = {
    emits: ['add'],
    data() {
        return {
            title: '',
            category: '',
            description: '',
            date: todayString()
        };
    },
    computed: {
        // Скільки символів опису ще можна ввести
        charsLeft() {
            return DESCRIPTION_MAX - this.description.length;
        },
        maxDate() {
            return todayString();
        }
    },
    methods: {
        // Заголовок не може складатися лише з пробілів
        checkTitle(event) {
            const input = event.target;
            if (input.value !== '' && input.value.trim() === '') {
                input.setCustomValidity('Заголовок не може складатися лише з пробілів');
            } else {
                input.setCustomValidity('');
            }
        },
        submit() {
            this.$emit('add', {
                title: this.title.trim(),
                category: this.category,
                description: this.description.trim(),
                date: this.date
            });
        }
    },
    template: `
        <form id="add-ad-form" class="add-form" @submit.prevent="submit">
            <h2>Нове оголошення</h2>

            <label for="ad-title">Заголовок:</label>
            <input type="text" id="ad-title" v-model="title" @input="checkTitle" required>

            <label for="ad-category">Категорія:</label>
            <select id="ad-category" v-model="category" required>
                <option value="">-- оберіть категорію --</option>
                <option value="Речі">Речі</option>
                <option value="Послуги">Послуги</option>
                <option value="Тварини">Тварини</option>
            </select>

            <label for="ad-description">Опис:</label>
            <textarea id="ad-description" v-model="description" rows="4" :maxlength="${DESCRIPTION_MAX}"></textarea>
            <span class="char-counter">Залишилось символів: {{ charsLeft }}</span>

            <label for="ad-date">Дата публікації:</label>
            <input type="date" id="ad-date" v-model="date" :max="maxDate" required>

            <div class="form-actions">
                <button type="submit">Опублікувати</button>
                <a href="#/" data-link class="back-link">Скасувати</a>
            </div>
        </form>
    `
};

// Головний застосунок: дані оголошень і поточна "сторінка"
const app = Vue.createApp({
    components: { AdCard, NewAdForm },
    data() {
        return {
            apiAds: [],
            savedAds: [],
            loading: false,
            errorMessage: '',
            storageMessage: '',
            useIndexedDB: true,
            newAdId: null,
            apiLoaded: false,
            savedLoaded: false,
            categoryFilter: 'all',
            // Поточна сторінка, яку встановлює роутер: home, detail, new, notFound
            page: 'home',
            params: {}
        };
    },
    computed: {
        // Усі оголошення: спочатку збережені (найновіші вгорі), потім з API
        ads() {
            const saved = [...this.savedAds]
                .sort((a, b) => b.id - a.id)
                .map(ad => ({
                    ...ad,
                    daysAgo: daysSince(ad.date),
                    deletable: true,
                    isNew: ad.id === this.newAdId
                }));
            return [...saved, ...this.apiAds];
        },
        // Оголошення після фільтра за категорією
        visibleAds() {
            if (this.categoryFilter === 'all') {
                return this.ads;
            }
            return this.ads.filter(ad => ad.category === this.categoryFilter);
        },
        // Кількість активних оголошень перераховується автоматично
        activeCount() {
            return this.visibleAds.filter(ad => !(ad.daysAgo > 14)).length;
        },
        // Оголошення для сторінки /posts/:id
        currentAd() {
            const id = Number(this.params.id);
            return this.ads.find(ad => ad.id === id) || null;
        },
        // Чи вже завантажені дані з API та зі сховища
        dataLoaded() {
            return this.apiLoaded && this.savedLoaded;
        }
    },
    methods: {
        // Викликається роутером: показує потрібну сторінку
        showPage(page, params = {}) {
            this.page = page;
            this.params = params;
        },
        // Завантаження оголошень з API JSONPlaceholder (як у практичній №9)
        async loadData() {
            this.loading = true;
            this.errorMessage = '';

            try {
                const response = await fetch(API_URL);
                if (!response.ok) {
                    throw new Error(`Сервер відповів кодом ${response.status}`);
                }
                const data = await response.json();

                this.apiAds = data.map(post => ({
                    id: post.id,
                    title: post.title,
                    category: 'З мережі',
                    description: post.body
                }));
            } catch (error) {
                this.errorMessage = 'Оголошення тимчасово недоступні. Спробуйте пізніше.';
                console.error('Помилка завантаження оголошень:', error);
            } finally {
                this.loading = false;
                this.apiLoaded = true;
            }
        },
        // Відкриття бази, міграція і перше читання збережених оголошень
        async initStorage() {
            try {
                await openDB();
                await migrateFromLocalStorage();
                this.savedAds = await getAllItems();
            } catch (error) {
                // IndexedDB недоступна - працюємо тільки з localStorage
                this.useIndexedDB = false;
                this.storageMessage = 'Локальна база даних недоступна, оголошення зберігаються лише в localStorage.';
                console.error('Помилка відкриття IndexedDB:', error);
                this.savedAds = loadFromLocalStorage();
            } finally {
                this.savedLoaded = true;
            }
        },
        // Перечитує збережені оголошення зі сховища
        async refreshSaved() {
            if (this.useIndexedDB) {
                this.savedAds = await getAllItems();
            }
            saveToLocalStorage(this.savedAds);
        },
        // Форма надіслана: переходимо на стрічку і додаємо оголошення
        onAdd(ad) {
            navigate('/');
            this.addAd(ad);
        },
        // Додавання оголошення
        async addAd(ad) {
            const newAd = { id: Date.now(), ...ad };
            try {
                if (this.useIndexedDB) {
                    await addItem(newAd);
                } else {
                    this.savedAds = [...this.savedAds, newAd];
                }
                // Позначаємо як нове ще до оновлення списку, щоб картка одразу з'явилася з анімацією
                this.showNewAd(newAd.id);
                await this.refreshSaved();
            } catch (error) {
                this.storageMessage = 'Не вдалося зберегти оголошення.';
                console.error('Помилка збереження:', error);
            }
        },
        // Позначає оголошення як нове: картка з'являється з анімацією,
        // а через NEW_BADGE_TIME позначку "Нове" прибираємо
        showNewAd(id) {
            this.newAdId = id;
            clearTimeout(this.newBadgeTimer);
            this.newBadgeTimer = setTimeout(() => {
                this.newAdId = null;
            }, NEW_BADGE_TIME);

            // Прокручуємо до початку стрічки, щоб було видно нове оголошення
            this.$nextTick(() => {
                if (this.$refs.listTop) {
                    this.$refs.listTop.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
        },
        // Видалення оголошення за id
        async deleteAd(id) {
            try {
                if (this.useIndexedDB) {
                    await deleteItem(id);
                } else {
                    this.savedAds = this.savedAds.filter(ad => ad.id !== id);
                }
                await this.refreshSaved();
            } catch (error) {
                this.storageMessage = 'Не вдалося видалити оголошення.';
                console.error('Помилка видалення:', error);
            }
        },
        // Видалення зі сторінки деталей - після нього повертаємось на стрічку
        async deleteFromDetail(id) {
            await this.deleteAd(id);
            navigate('/');
        }
    },
    mounted() {
        this.initStorage();
        this.loadData();
    },
    unmounted() {
        clearTimeout(this.newBadgeTimer);
    },
    template: `
        <!-- Сторінка "/" - стрічка оголошень -->
        <template v-if="page === 'home'">
            <section id="filter">
                <h2>Фільтр за категорією</h2>
                <form @submit.prevent>
                    <label for="category-select">Оберіть категорію:</label>
                    <select id="category-select" v-model="categoryFilter">
                        <option value="all">Всі оголошення</option>
                        <option value="Речі">Речі</option>
                        <option value="Послуги">Послуги</option>
                        <option value="Тварини">Тварини</option>
                        <option value="З мережі">З мережі</option>
                    </select>
                </form>
            </section>

            <section id="ads">
                <h2>Оголошення</h2>

                <div class="list-controls" ref="listTop">
                    <button type="button" class="btn-reload" :disabled="loading" @click="loadData">Оновити</button>
                    <p class="load-status" :class="{ error: errorMessage }" role="status">
                        {{ loading ? 'Завантаження...' : errorMessage }}
                    </p>
                </div>

                <p v-if="storageMessage" class="storage-status">{{ storageMessage }}</p>

                <p id="listings-count">Активних оголошень: {{ activeCount }}</p>

                <div class="cards-grid">
                    <ad-card
                        v-for="ad in visibleAds"
                        :key="ad.id"
                        :id="ad.id"
                        :title="ad.title"
                        :category="ad.category"
                        :description="ad.description"
                        :days-ago="ad.daysAgo"
                        :deletable="ad.deletable"
                        :is-new="ad.isNew"
                        @delete="deleteAd"
                    ></ad-card>
                </div>
            </section>
        </template>

        <!-- Сторінка "/posts/:id" - деталі одного оголошення -->
        <section v-else-if="page === 'detail'" class="detail-page">
            <a href="#/" data-link class="back-link">← До стрічки</a>

            <ad-card
                v-if="currentAd"
                :key="currentAd.id"
                :id="currentAd.id"
                :title="currentAd.title"
                :category="currentAd.category"
                :description="currentAd.description"
                :days-ago="currentAd.daysAgo"
                :deletable="currentAd.deletable"
                detailed
                @delete="deleteFromDetail"
            ></ad-card>
            <p v-else-if="!dataLoaded">Завантаження...</p>
            <div v-else class="not-found">
                <h2>Оголошення не знайдено</h2>
                <p>Можливо, його вже видалили.</p>
            </div>
        </section>

        <!-- Сторінка "/new" - форма нового оголошення -->
        <section v-else-if="page === 'new'">
            <new-ad-form @add="onAdd"></new-ad-form>
        </section>

        <!-- Неіснуючий маршрут -->
        <section v-else class="not-found">
            <h2>Сторінку не знайдено</h2>
            <p>Такої сторінки на дошці немає.</p>
            <a href="#/" data-link>Перейти на головну</a>
        </section>
    `
});

const adsApp = app.mount('#app');

// ----- Клієнтська маршрутизація (hash-based) -----

// Сторінки застосунку. Кожна view-функція передає роутеру Vue,
// яку сторінку показати в контейнері #app (Vue сам замінює вміст)
function renderHome() {
    adsApp.showPage('home');
}

function renderPostDetail(params) {
    adsApp.showPage('detail', params);
}

function renderNewPost() {
    adsApp.showPage('new');
}

function renderNotFound() {
    adsApp.showPage('notFound');
}

// Таблиця маршрутів: шаблон шляху -> view-функція (:id - параметр)
const routes = [
    { path: '/', view: renderHome },
    { path: '/posts/:id', view: renderPostDetail },
    { path: '/new', view: renderNewPost }
];

// Шукає маршрут для шляху і витягує параметри (наприклад, id з /posts/21)
function matchRoute(path) {
    const pathParts = path.split('/').filter(Boolean);

    for (const route of routes) {
        const routeParts = route.path.split('/').filter(Boolean);
        if (routeParts.length !== pathParts.length) continue;

        const params = {};
        const isMatch = routeParts.every((part, i) => {
            if (part.startsWith(':')) {
                params[part.slice(1)] = decodeURIComponent(pathParts[i]);
                return true;
            }
            return part === pathParts[i];
        });

        if (isMatch) return { view: route.view, params };
    }
    return null;
}

// Підсвічує в меню посилання поточної сторінки
function updateActiveLinks(path) {
    document.querySelectorAll('header nav a[data-link]').forEach(link => {
        link.classList.toggle('active', link.getAttribute('href') === '#' + path);
    });
}

// Шлях сторінки, яка зараз показана
let currentPath = null;

// Головна функція роутера: читає шлях з хеша і показує потрібну сторінку
function router() {
    const path = location.hash.slice(1) || '/';

    // Ця сторінка вже показана (наприклад, hashchange після navigate) - нічого не робимо
    if (path === currentPath) return;
    currentPath = path;

    const match = matchRoute(path);

    if (match) {
        match.view(match.params);
    } else {
        renderNotFound();
    }

    updateActiveLinks(path);
    window.scrollTo(0, 0);
}

// Перехід на іншу сторінку без перезавантаження
function navigate(path) {
    if (location.hash !== '#' + path) {
        location.hash = path;
    }
    router();
}

// Кліки по посиланнях з data-link обробляємо самі, без переходу браузера
document.addEventListener('click', event => {
    const link = event.target.closest('a[data-link]');
    if (!link) return;

    event.preventDefault();
    navigate(link.getAttribute('href').slice(1));
});

// Кнопки "назад"/"вперед" браузера змінюють хеш - перемальовуємо сторінку
window.addEventListener('hashchange', router);

// Перший рендер за адресою, з якою відкрили сторінку
router();
