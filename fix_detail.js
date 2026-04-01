const fs = require('fs');
let content = fs.readFileSync('app/detail/page.tsx', 'utf8');

const startMarker = '\n            {/* Mobile:';
const endMarker = '            </div>\n          </div>\n\n          {/* Technical Indicators Detail */}';

const startIdx = content.indexOf(startMarker);
const endIdx = content.indexOf(endMarker);

if (startIdx === -1) { console.log('Start not found'); process.exit(1); }
if (endIdx === -1) { console.log('End not found'); process.exit(1); }

const replacement = `
            {detailLoading ? (
              <div className="p-4 space-y-3">
                {[0,1,2,3,4,5].map(i => <div key={i} className="animate-pulse h-12 rounded-lg bg-slate-100" />)}
              </div>
            ) : (
              <>
                {/* Mobile: 모바일 목록 */}
                <div className="md:hidden divide-y divide-slate-100">
                  {paginatedEtfs.map(({ ticker, name, price, change, volume, signal, score, up }) => (
                    <div key={ticker} className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 text-sm leading-tight truncate">{name}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{ticker} · 거래량 {volume}</p>
                        </div>
                        <span className={\`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold \${
                          signal === '매수' ? 'bg-emerald-50 text-emerald-600' :
                          signal === '관망' ? 'bg-slate-100 text-slate-500' :
                          'bg-amber-50 text-amber-600'
                        }\`}>{signal}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-semibold text-slate-800 text-sm">{price}</span>
                        <span className={\`text-sm font-bold \${up ? 'text-emerald-600' : 'text-red-500'}\`}>{change}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400 w-14 shrink-0">AI Score</span>
                        <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className={\`h-full rounded-full \${score > 0 ? 'bg-emerald-500' : 'bg-red-400'}\`}
                            style={{ width: \`\${Math.min(Math.abs(score) / 4 * 100, 100)}%\` }}
                          />
                        </div>
                        <span className={\`text-xs font-bold w-8 text-right shrink-0 \${score > 0 ? 'text-emerald-600' : 'text-red-500'}\`}>
                          {score > 0 ? '+' : ''}{score}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop: 데스크탑 보기 */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">
                        {['ETF', '현재가', '변동률', '거래량', 'AI Score', '신호'].map((h) => (
                          <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {paginatedEtfs.map(({ ticker, name, price, change, volume, signal, score, up }) => (
                        <tr key={ticker} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3">
                            <p className="font-semibold text-slate-900 text-sm leading-tight">{name}</p>
                            <p className="text-[10px] text-slate-400">{ticker}</p>
                          </td>
                          <td className="px-4 py-3 font-mono font-semibold text-slate-800">{price}</td>
                          <td className={\`px-4 py-3 font-bold \${up ? 'text-emerald-600' : 'text-red-500'}\`}>{change}</td>
                          <td className="px-4 py-3 text-slate-500 text-xs">{volume}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                <div
                                  className={\`h-full rounded-full \${score > 0 ? 'bg-emerald-500' : 'bg-red-400'}\`}
                                  style={{ width: \`\${Math.min(Math.abs(score) / 4 * 100, 100)}%\` }}
                                />
                              </div>
                              <span className={\`text-xs font-bold \${score > 0 ? 'text-emerald-600' : 'text-red-500'}\`}>
                                {score > 0 ? '+' : ''}{score}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={\`rounded-full px-2.5 py-1 text-xs font-bold \${
                              signal === '매수' ? 'bg-emerald-50 text-emerald-600' :
                              signal === '관망' ? 'bg-slate-100 text-slate-500' :
                              'bg-amber-50 text-amber-600'
                            }\`}>{signal}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* ETF 페이지네이션 */}
                <div className="flex items-center justify-between px-5 pb-5 pt-4 text-xs text-slate-500">
                  <button
                    className="rounded-full border border-slate-200 px-3 py-1 transition-colors hover:border-slate-300 disabled:opacity-40"
                    onClick={() => setCurrentEtfPage((p) => Math.max(1, p - 1))}
                    disabled={currentEtfPage === 1}
                  >
                    이전
                  </button>
                  <span>{currentEtfPage} / {totalEtfPages}</span>
                  <button
                    className="rounded-full border border-slate-200 px-3 py-1 transition-colors hover:border-slate-300 disabled:opacity-40"
                    onClick={() => setCurrentEtfPage((p) => Math.min(totalEtfPages, p + 1))}
                    disabled={currentEtfPage === totalEtfPages}
                  >
                    다음
                  </button>
                </div>
              </>
            )}`;

const newContent = content.substring(0, startIdx) + replacement + content.substring(endIdx);
fs.writeFileSync('app/detail/page.tsx', newContent, 'utf8');
console.log('Done. New file length:', newContent.length);
