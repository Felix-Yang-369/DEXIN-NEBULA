-- Internal policy and knowledge center.
-- The first published documents are curated from the company's existing Word files.

create table if not exists public.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  slug text not null,
  title text not null,
  title_en text,
  category_code text not null
    check (category_code in ('culture', 'conduct', 'administration', 'attendance', 'reporting', 'organization')),
  summary text not null,
  content text not null,
  keywords text[] not null default '{}',
  owner_label text,
  source_file_name text,
  version text not null default '1.0',
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  effective_on date,
  published_at timestamptz,
  created_by_employee_id uuid references public.employees(id) on delete set null,
  updated_by_employee_id uuid references public.employees(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create index if not exists knowledge_documents_org_status_idx
  on public.knowledge_documents (organization_id, status, category_code, published_at desc);

create index if not exists knowledge_documents_keywords_idx
  on public.knowledge_documents using gin (keywords);

drop trigger if exists knowledge_documents_set_updated_at
  on public.knowledge_documents;
create trigger knowledge_documents_set_updated_at
before update on public.knowledge_documents
for each row execute function public.set_updated_at();

alter table public.knowledge_documents enable row level security;

drop policy if exists knowledge_documents_select_internal
  on public.knowledge_documents;
create policy knowledge_documents_select_internal
on public.knowledge_documents
for select
to authenticated
using (
  organization_id = (select public.current_organization_id())
  and status = 'published'
  and (select public.current_employee_id()) is not null
);

drop policy if exists knowledge_documents_manage_hr_admin
  on public.knowledge_documents;
create policy knowledge_documents_manage_hr_admin
on public.knowledge_documents
for all
to authenticated
using (
  organization_id = (select public.current_organization_id())
  and (
    (select public.has_org_role('hr'))
    or (select public.has_org_role('admin'))
  )
)
with check (
  organization_id = (select public.current_organization_id())
  and (
    (select public.has_org_role('hr'))
    or (select public.has_org_role('admin'))
  )
);

revoke all on table public.knowledge_documents from anon;
grant select, insert, update, delete on table public.knowledge_documents to authenticated;

with target_organization as (
  select id
  from public.organizations
  where slug = 'dexin-miaosheng'
  limit 1
)
insert into public.knowledge_documents (
  organization_id,
  slug,
  title,
  title_en,
  category_code,
  summary,
  content,
  keywords,
  owner_label,
  source_file_name,
  version,
  status,
  published_at
)
select
  target_organization.id,
  seed.slug,
  seed.title,
  seed.title_en,
  seed.category_code,
  seed.summary,
  seed.content,
  seed.keywords,
  seed.owner_label,
  seed.source_file_name,
  '1.0',
  'published',
  now()
from target_organization
cross join (
  values
    (
      'corporate-culture',
      '企业介绍与企业文化',
      'Company Profile & Corporate Culture',
      'culture',
      '了解德馨淼盛的企业定位、使命、愿景、价值观与经营理念。',
      $doc$
# 企业介绍与企业文化

## 一、企业介绍

德馨淼盛成立于 2011 年，总部位于湖南长沙，是一家专注于粮油产品、企业礼品及供应链服务的综合型企业。

公司长期服务于餐饮企业、企事业单位及团购客户，为客户提供从产品选择、价格方案、集中采购、仓储配送到售后服务的一体化供应链解决方案，帮助客户降低采购成本、提高采购效率并保障供应稳定。

## 二、企业定位

值得信赖的粮油与企业礼品供应链服务商。

## 三、企业使命

让粮油供应更稳定，让企业采购更省心。

## 四、企业愿景

成为中国值得信赖的企业供应链服务平台。

- 为客户提供稳定、透明、高效的供应链服务。
- 为员工创造长期成长与实现价值的平台。
- 与品牌和工厂建立长期、稳定、共赢的合作关系。
- 通过数字化提升供应链协同效率。

## 五、企业价值观

- 诚信为本：诚实守信，真实透明，对客户、合作伙伴和同事负责。
- 客户第一：从客户需求出发，为客户创造长期价值。
- 专业可靠：以专业能力解决问题，以稳定交付赢得信任。
- 协同共赢：部门协同、伙伴协同，共同创造价值。
- 持续精进：保持学习，不断优化产品、服务和流程。

## 六、企业精神

诚信 · 专业 · 高效 · 共赢

## 七、企业口号

稳定供应 · 省心采购

Stable Supply · Worry-Free Procurement

## 八、经营理念

让采购更简单，让合作更长久。

## 九、文化理念

开放、务实、担当、成长。
$doc$,
      array['企业文化', '使命', '愿景', '价值观', '企业介绍', '经营理念'],
      '公司管理层',
      '企业文化.docx'
    ),
    (
      'employee-code-of-conduct',
      '员工行为准则',
      'Employee Code of Conduct',
      'conduct',
      '全体员工在工作纪律、客户往来、廉洁自律、保密与信息安全方面的共同底线。',
      $doc$
# 员工行为准则

## 一、基本原则

- 遵守国家法律法规、公司制度和岗位要求。
- 坚持诚信、专业、负责、协同的工作原则。
- 尊重客户、合作伙伴和同事，不实施歧视、侮辱、骚扰或其他不当行为。
- 对自己的工作结果负责，发现问题主动沟通、及时解决。

## 二、工作纪律与职业形象

- 按考勤制度准时出勤，因故迟到、早退或缺勤应及时报告并办理手续。
- 工作时间保持专注，不从事影响本职工作的无关活动。
- 对外沟通使用礼貌、准确、克制的表达，维护公司品牌形象。
- 进入客户、仓库及合作伙伴场所时，遵守现场安全与管理规范。

## 三、岗位履责与内部协作

- 清楚岗位职责、工作标准和交付时间，不推诿、不隐瞒、不虚报。
- 对跨部门事项明确负责人、时间节点和交付结果。
- 重要事项通过公司认可的渠道留痕，确保可追溯。
- 发现影响客户、供应、库存、资金或安全的风险，应立即向负责人报告。

## 四、客户与供应商往来

- 以公司授权范围内的价格、合同和政策开展业务。
- 不向客户或供应商作超出权限的承诺。
- 不以个人名义截留订单、客户资源、差价、佣金或其他利益。
- 客户投诉和质量问题应如实记录并按流程处理。

## 五、廉洁自律与利益冲突

- 不索取或收受可能影响公正履职的礼金、回扣、好处费或贵重礼品。
- 与客户、供应商或竞争方存在亲属、投资、兼职等利益关系时，应主动申报。
- 不利用岗位权限为本人或他人谋取不当利益。

## 六、保密与信息安全

- 客户资料、价格政策、采购成本、供应商信息、员工资料和经营数据均属于内部信息。
- 未经授权，不得复制、转发、下载或向外部披露内部资料。
- 账号与密码仅限本人使用，不共享、不代登；离开设备时及时锁屏。
- 发现账号异常、文件误发或数据泄露风险时，应立即报告。

## 七、公司资产、费用与记录

- 爱护公司设备、车辆、货物、文件和数字账号。
- 报销、采购、库存及业务记录必须真实、准确、完整。
- 不伪造凭证，不虚报费用，不私自挪用公司资产。

## 八、质量、安全与风险报告

- 遵守食品安全、仓储、装卸、配送和消防要求。
- 对破损、临期、错发、短缺、异常库存等情况及时记录并上报。
- 不隐瞒可能导致客户损失、公司损失或人身伤害的风险。

## 九、禁止行为

- 侵占、挪用、盗窃公司或他人财物。
- 泄露商业秘密、客户信息或员工隐私。
- 伪造业务、财务、考勤或审批记录。
- 在工作场所实施暴力、威胁、赌博或其他违法行为。
- 以公司名义从事未经授权的经营或担保活动。

## 十、违规处理与申诉

公司依据事实、影响程度和相关制度处理违规行为：

- 一般违规：提醒沟通、限期改进或参加培训。
- 较重违规：书面警示、整改、绩效或岗位调整。
- 严重违规：依法依规采取劳动合同及其他处理措施；涉嫌违法犯罪的，移交有关机关。

员工有权说明情况和提出申诉。公司保护善意报告问题的员工，不得进行打击报复。

## 十一、制度告知与更新

本准则适用于全体员工，由公司根据法律法规和经营需要进行解释、修订和告知。
$doc$,
      array['员工行为', '职业道德', '廉洁', '保密', '信息安全', '违规'],
      '行政人事',
      '员工行为准则.docx'
    ),
    (
      'administrative-management',
      '行政管理制度',
      'Administrative Management Policy',
      'administration',
      '规范办公秩序、资产用品、安全用电和公共区域管理，形成整洁高效的工作环境。',
      $doc$
# 行政管理制度

## 一、目的与适用范围

本制度用于规范公司日常行政管理，营造整洁、有序、安全、节约的办公环境，适用于全体员工。

行政管理遵循“整洁有序、安全节约、责任到人、持续改善”的原则。行政人事负责统筹、检查和改进，各部门负责人对本部门区域及人员承担管理责任。

## 二、办公秩序

- 员工应按要求使用办公区域，不得高声喧哗或影响他人工作。
- 工位文件、物品和设备保持整齐，重要文件及时归档。
- 下班前关闭电脑、照明及非必要电源，关好门窗。
- 会议室、接待区和公共区域使用后及时恢复整洁。

## 三、空调与节能

- 室温低于 26℃ 时优先自然通风。
- 室温为 26℃ 至 30℃ 时优先使用风扇等节能方式。
- 室温达到或超过 30℃ 时可开启空调，制冷温度原则上不低于 26℃。
- 最后离开区域的员工负责确认空调、风扇和照明已经关闭。

## 四、办公设备与用电

- 办公设备按说明和授权使用，不私自拆装或改变配置。
- 设备故障应及时报修，不带故障继续使用。
- 严禁私拉电线、使用不合规电器或堵塞消防通道。
- 个人不得擅自将公司设备带离办公场所。

## 五、办公用品

- 办公用品根据实际需要申请、领用和登记。
- 坚持节约原则，避免重复申领、囤积和浪费。
- 特殊或大额用品按采购审批流程办理。

## 六、固定资产

- 固定资产建立台账，明确使用人或责任人。
- 调拨、维修、报废或外借应按流程审批并更新记录。
- 使用人应妥善保管，发现损坏、遗失或异常及时报告。

## 七、公共区域与环境

- 茶水间、卫生间、走道和会议室共同维护。
- 垃圾及时分类处理，食品和易腐物品不得长期存放。
- 不在禁烟区域吸烟，不占用消防设施和应急通道。

## 八、安全与应急

- 员工应熟悉消防设施、疏散路线和应急联系人。
- 发现火灾、漏水、漏电、治安或其他安全隐患立即报告。
- 涉及人员安全的紧急情况，优先采取合理的避险和报警措施。

## 九、监督与执行

行政人事定期检查办公环境、资产和安全情况。发现问题时明确责任人和整改期限；屡次不整改或造成损失的，按公司有关制度处理。
$doc$,
      array['行政', '办公秩序', '固定资产', '办公用品', '安全', '空调', '用电'],
      '行政人事主管',
      '行政管理制度.docx'
    ),
    (
      'attendance-and-leave',
      '考勤管理制度',
      'Attendance & Leave Management Policy',
      'attendance',
      '明确工作时间、考勤记录、迟到早退、请假审批和年度福利假规则。',
      $doc$
# 考勤管理制度

## 一、适用范围

本制度适用于公司全体员工，由行政人事主管负责日常考勤管理、记录与解释。

## 二、工作时间

公司执行单休工作安排，周六正常办公。经直属负责人批准，固定周六可采用远程办公方式；员工应保持通讯畅通并完成当日工作。业务需要时应配合晚间必要的工作响应。

- 上午：08:30—12:00
- 午休：12:00—13:30
- 下午：13:30—17:00

## 三、不同岗位的考勤要求

- 行政及固定办公岗位按规定时间和公司考勤方式记录出勤。
- 销售等外勤岗位实行相对灵活管理，每日仍需通过企业微信完成考勤或工作报备。
- 客户拜访、外出办事应按要求提供时间、地点、照片或工作记录，并保持通讯畅通。

## 四、迟到、早退与异常

未按规定时间到岗且无事先批准，视为迟到；提前离岗且无批准，视为早退。因交通突发、客户现场或其他合理原因造成异常时，应及时说明并补充证明。

公司以沟通、提醒和改进为主，不设置简单固定金额罚款。重复出现或影响工作的，将根据频次、原因和实际影响进行面谈、书面提醒或进一步管理。

## 五、请假申请

- 原则上应提前通过德馨星云提交请假申请，说明类型、时间、原因和交接安排。
- 紧急情况应先通知直属负责人，并在返岗后及时补办手续。
- 未经批准擅自离岗、未办理手续且无合理说明的，按旷工或相关制度处理。

## 六、审批路径

- 请假不超过 1 天：直属负责人审批后，由行政人事备案。
- 请假超过 1 天：直属负责人审批后，提交董事长审批，再由行政人事备案。
- 审批完成前，申请人应合理安排工作并确保重要事项已交接。

## 七、年度福利假

员工通过试用期后，每自然年度享有 4 天福利假；连续服务每满一年增加 1 天，年度上限 10 天。

福利假原则上仅限当年度使用，不跨年度累计。实际余额以员工档案和已完成审批记录为准。

## 八、考勤记录与核对

行政人事按月汇总考勤。员工应及时核对异常记录并提交说明，不得代打卡、伪造定位、照片或其他考勤资料。

## 九、违规与处理

对频繁迟到早退、虚假考勤、未经批准缺勤或拒不配合考勤管理的情况，公司依据事实、影响和相关制度处理，并保留沟通与记录。

## 十、附则

本制度未尽事项按国家法律法规和公司其他制度执行；如制度更新，以公司正式发布版本为准。
$doc$,
      array['考勤', '请假', '迟到', '早退', '福利假', '周六', '工作时间', '远程办公'],
      '行政人事主管',
      '考勤管理制度.docx'
    ),
    (
      'weekly-report-and-quarterly-review',
      '周报与季度汇报制度',
      'Weekly Report & Quarterly Review Policy',
      'reporting',
      '规范员工周报、季度经营会议和会后执行，让信息同步与问题闭环有据可查。',
      $doc$
# 周报与季度汇报制度

## 一、制度目的

通过固定节奏的工作汇报提升沟通与执行效率，及时暴露问题、协调资源，并让重要经营事项形成记录和闭环。

## 二、周报提交

全体员工应在每周一之前，通过企业微信私信向直属负责人提交上周周报。

周报应包含以下模块：

- 本周完成工作：写明已经完成的事项及可验证结果。
- 当前推进事项：说明进度、负责人、计划节点和下一步动作。
- 存在的问题：说明阻碍、风险以及需要的协助。
- 下周工作计划：列出重点任务、目标结果和预计完成时间。

汇报应简洁、真实、可执行，避免只描述过程而没有结果。

## 三、季度经营汇报

公司每年围绕主要经营周期组织四次经营会议：

- 春节季经营复盘与计划会
- 端午季经营复盘与计划会
- 中秋季经营复盘与计划会
- 年终经营总结与下一年度计划会

部门负责人使用 PPT 汇报，原则上全员参加。会议应形成会议纪要、问题清单、责任人和完成期限。

## 四、季度汇报内容

- 阶段目标与完成情况
- 销售、客户、采购、库存、回款或部门核心数据
- 关键项目进度与成果
- 存在的问题、原因和风险
- 下一阶段目标、计划与资源需求

## 五、会议纪律

- 数据和事实真实准确，不隐瞒问题。
- 汇报人提前准备，按时参加，聚焦关键事项。
- 讨论形成明确结论，决策事项落实到责任人和时间。
- 会后跟踪执行，未完成事项说明原因并调整计划。

## 六、责任归属

本制度由运营管理负责人组织执行，各部门负责人负责本部门周报与季度汇报的质量和跟进。
$doc$,
      array['周报', '季度汇报', '经营会议', '春节', '端午', '中秋', '年终复盘'],
      '运营副总经理',
      '会议管理制度.docx'
    ),
    (
      'job-responsibility-review',
      '岗位职责梳理工作指引',
      'Job Responsibility Review Guide',
      'organization',
      '指导全员梳理岗位职责、工作流程、协同关系和改进建议，形成正式岗位说明书。',
      $doc$
# 岗位职责梳理工作指引

## 一、工作目的

为进一步明确岗位职责、优化工作流程、提升团队协作效率，公司开展全员岗位职责梳理。梳理结果将用于完善岗位说明书、绩效管理、培训计划和组织协同。

## 二、填报对象

公司全体员工。

## 三、梳理内容

- 基本信息：姓名、部门、岗位、直属负责人等。
- 核心职责：列出 5—10 项主要职责，说明工作目标和交付结果。
- 工作流程：分别梳理日常、每周、每月和阶段性工作。
- 资源与资产：说明负责或使用的系统、设备、车辆、货物、文件及其他资源。
- 协同关系：列出主要协作部门、人员和上下游交付关系。
- 问题与建议：提出职责不清、重复工作、流程阻碍和改进建议。

## 四、填写要求

- 以实际工作为依据，内容真实、具体、可验证。
- 重点描述职责和成果，不只罗列零散任务。
- 涉及多人协作的事项，明确本岗位承担的责任边界。
- 对暂时存在的职责交叉或空缺如实说明。

## 五、提交与确认

完成后通过企业微信或公司指定渠道提交直属负责人审核。直属负责人统一确认职责边界，必要时组织跨部门沟通。

本次梳理本身不直接作为单次绩效评价依据；经沟通确认后，将逐步形成正式岗位说明书并纳入日常管理。
$doc$,
      array['岗位职责', '岗位说明书', '职责梳理', '工作流程', '协同关系'],
      '行政人事',
      '岗位职责梳理.docx'
    )
) as seed (
  slug,
  title,
  title_en,
  category_code,
  summary,
  content,
  keywords,
  owner_label,
  source_file_name
)
on conflict (organization_id, slug)
do update set
  title = excluded.title,
  title_en = excluded.title_en,
  category_code = excluded.category_code,
  summary = excluded.summary,
  content = excluded.content,
  keywords = excluded.keywords,
  owner_label = excluded.owner_label,
  source_file_name = excluded.source_file_name,
  status = excluded.status,
  published_at = excluded.published_at,
  updated_at = now();
