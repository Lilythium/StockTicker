import {css, html, LitElement} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';
import { Stock, StockPrices } from "../../common";

@customElement("stock-chart")
export default class StockChart extends LitElement {
    @property()
    prices: StockPrices | undefined;

    // use light dom
    protected createRenderRoot(): HTMLElement | DocumentFragment { return this; }

    render() {
        const rows = [
            { name: 'Gold', class: 'gold', display: 'Gold' },
            { name: 'Silver', class: 'silver', display: 'Silver' },
            { name: 'Oil', class: 'oil', display: 'Oil' },
            { name: 'Bonds', class: 'bonds', display: 'Bonds' },
            { name: 'Industrials', class: 'industrials', display: 'Indust.' },
            { name: 'Grain', class: 'grain', display: 'Grain' }
        ];

        let header_items = [];
        for (let p = 0; p <= 200; p += 5) {
            const isSpecial = [0, 100, 200].includes(p);
            header_items.push(html`<th class="${isSpecial ? 'price-header-special' : 'price-header'}">${p}</th>`);
        }
        let header_row = html`
            <tr>
                <th class="corner-cell"></th>
                ${header_items}
            </tr>
        `;

        let body_rows = rows.map(row => {
            let items = [];
            for (let pC = 0; pC <= 200; pC += 5) {
                const special = [0, 100, 200].includes(pC);
                const label = pC === 0 ? 'Off Market' : (pC === 100 ? 'Par' : (pC === 200 ? 'Split' : ''));
                const is_current = this.prices ? this.prices[row.name as Stock] == pC : false;
                items.push(html`
                    <td
                        class="
                            price-cell
                            ${special && !is_current ? 'price-cell-special' : ''}
                            ${is_current ? "current-price" : ""}
                        " 
                        data-label=${label}
                    >
                        <div ?hidden=${!is_current}>${pC}</div>
                    </td>
                `);
            }
            
            return html`
                <tr class="stock-row ${row.class}-row">
                    <th class="stock-header ${row.class}-header">${row.display}</th>
                    ${items}
                </tr>
            `;
        });

        return html`
            <table class="stock-price-table">
                <thead>${header_row}</thead>
                <tbody>${body_rows}</tbody>
            </table>
        `;
    }
}