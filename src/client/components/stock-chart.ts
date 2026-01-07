import { Stock, StockPrices } from "../../interface";

export default class StockChart extends HTMLElement {
    #prices: StockPrices | undefined;

    constructor() {
        super();
    }

    set prices(value: StockPrices) {
        this.#prices = value;
        this.update();
    }

    private update() {
        if(this.#prices === undefined) return;
        for (const stock_name of Object.keys(this.#prices)) {
            const price = this.#prices[stock_name as Stock];

            const stock_cells = document.querySelectorAll(`td[data-stock="${stock_name}"]`);
            stock_cells.forEach(cell => {
                cell.classList.remove('current-price');
                const marker = cell.querySelector('.price-marker');
                if (marker) marker.remove();
            });

            const target_cell = document.querySelector(`td[data-stock="${stock_name}"][data-price="${price}"]`);
            if (target_cell) {
                target_cell.classList.add('current-price');
                const marker = document.createElement('div');
                marker.className = 'price-marker';
                marker.textContent = price.toString();
                target_cell.appendChild(marker);
            }
        }
    }

    connectedCallback() {
        this.render();
    }

    private render() {
        const rows = [
            { name: 'Gold', class: 'gold', display: 'Gold' },
            { name: 'Silver', class: 'silver', display: 'Silver' },
            { name: 'Oil', class: 'oil', display: 'Oil' },
            { name: 'Bonds', class: 'bonds', display: 'Bonds' },
            { name: 'Industrials', class: 'industrials', display: 'Indust.' },
            { name: 'Grain', class: 'grain', display: 'Grain' }
        ];

        let headerRow = '<tr><th class="corner-cell"></th>';
        for (let p = 0; p <= 200; p += 5) {
            const isSpecial = [0, 100, 200].includes(p);
            headerRow += `<th class="${isSpecial ? 'price-header-special' : 'price-header'}">${p}</th>`;
        }
        headerRow += '</tr>';

        let bodyRows = '';
        rows.forEach(row => {
            bodyRows += `<tr class="stock-row ${row.class}-row">
                <th class="stock-header ${row.class}-header">${row.display}</th>`;
            
            for (let pC = 0; pC <= 200; pC += 5) {
                const special = [0, 100, 200].includes(pC);
                const label = pC === 0 ? 'Off Market' : (pC === 100 ? 'Par' : (pC === 200 ? 'Split' : ''));
                bodyRows += `<td class="price-cell ${special ? 'price-cell-special' : ''}" 
                    data-stock="${row.name}" data-price="${pC}" data-label="${label}"></td>`;
            }
            bodyRows += '</tr>';
        });

        this.innerHTML = `
            <table class="stock-price-table">
                <thead>${headerRow}</thead>
                <tbody>${bodyRows}</tbody>
            </table>
        `;
    }
}

customElements.define("stock-chart", StockChart);