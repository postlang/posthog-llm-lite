import React, { useMemo, useState } from 'react'
import { useActions, useValues } from 'kea'
import { DownloadOutlined, UsergroupAddOutlined } from '@ant-design/icons'
import { Modal, Button, Input, Skeleton } from 'antd'
import { FilterType, InsightType, ActorType } from '~/types'
import { personsModalLogic } from './personsModalLogic'
import { CopyToClipboardInline } from 'lib/components/CopyToClipboard'
import { isGroupType, midEllipsis, pluralize } from 'lib/utils'
import './PersonsModal.scss'
import { PropertyKeyInfo } from 'lib/components/PropertyKeyInfo'
import { PropertiesTable } from 'lib/components/PropertiesTable'
import { DateDisplay } from 'lib/components/DateDisplay'
import { preflightLogic } from 'scenes/PreflightCheck/logic'
import { PersonHeader } from '../persons/PersonHeader'
import api from '../../lib/api'
import { LemonTable, LemonTableColumns } from 'lib/components/LemonTable'
import { LemonTabs } from 'lib/components/LemonTabs'
import { GroupActorHeader } from 'scenes/persons/GroupActorHeader'
import { IconPersonFilled, IconUnfoldLess, IconUnfoldMore } from 'lib/components/icons'
import { LemonButton } from 'lib/components/LemonButton'
import { IconPerson, IconRobot } from 'lib/components/icons'
import { MessageRender } from 'lib/components/MessageRender'

export interface PersonsModalProps {
    visible: boolean
    view: InsightType
    filters: Partial<FilterType>
    onSaveCohort: () => void
    showModalActions?: boolean
    aggregationTargetLabel: { singular: string; plural: string }
}

export function PersonsModal({
    visible,
    view,
    filters,
    onSaveCohort,
    showModalActions = true,
    aggregationTargetLabel,
}: PersonsModalProps): JSX.Element {
    const {
        people,
        loadingMorePeople,
        firstLoadedPeople,
        searchTerm,
        isInitialLoad,
        clickhouseFeaturesEnabled,
        peopleParams,
    } = useValues(personsModalLogic)
    const { hidePeople, loadMorePeople, setFirstLoadedActors, setPersonsModalFilters, setSearchTerm } =
        useActions(personsModalLogic)
    const { preflight } = useValues(preflightLogic)

    const title = useMemo(
        () =>
            isInitialLoad ? (
                `Loading ${aggregationTargetLabel.plural}…`
            ) : filters.shown_as === 'Stickiness' ? (
                <>
                    <PropertyKeyInfo value={people?.label || ''} disablePopover /> stickiness on day {people?.day}
                </>
            ) : filters.display === 'ActionsBarValue' || filters.display === 'ActionsPie' ? (
                <PropertyKeyInfo value={people?.label || ''} disablePopover />
            ) : filters.insight === InsightType.FUNNELS ? (
                <>
                    {(people?.funnelStep ?? 0) >= 0 ? 'Completed' : 'Dropped off at'} step{' '}
                    {Math.abs(people?.funnelStep ?? 0)} • <PropertyKeyInfo value={people?.label || ''} disablePopover />{' '}
                    {!!people?.breakdown_value ? `• ${people.breakdown_value}` : ''}
                </>
            ) : filters.insight === InsightType.PATHS ? (
                <>
                    {people?.pathsDropoff ? 'Dropped off after' : 'Completed'} step{' '}
                    <PropertyKeyInfo value={people?.label.replace(/(^[0-9]+_)/, '') || ''} disablePopover />
                </>
            ) : (
                <>
                    <PropertyKeyInfo value={people?.label || ''} disablePopover /> on{' '}
                    <DateDisplay interval={filters.interval || 'day'} date={people?.day?.toString() || ''} />
                </>
            ),
        [filters, people, isInitialLoad]
    )

    const isDownloadCsvAvailable = view === InsightType.TRENDS && showModalActions
    const isSaveAsCohortAvailable =
        clickhouseFeaturesEnabled &&
        (view === InsightType.TRENDS || view === InsightType.STICKINESS) &&
        showModalActions

    return (
        <Modal
            title={title}
            visible={visible}
            onOk={hidePeople}
            onCancel={hidePeople}
            footer={
                people &&
                people.count > 0 &&
                (isDownloadCsvAvailable || isSaveAsCohortAvailable) && (
                    <>
                        {isDownloadCsvAvailable && (
                            <Button
                                icon={<DownloadOutlined />}
                                href={api.actions.determinePeopleCsvUrl(
                                    {
                                        label: people.label,
                                        action: people.action,
                                        date_from: people.day,
                                        date_to: people.day,
                                        breakdown_value: people.breakdown_value,
                                    },
                                    filters
                                )}
                                style={{ marginRight: 8 }}
                                data-attr="person-modal-download-csv"
                            >
                                Download CSV
                            </Button>
                        )}
                        {isSaveAsCohortAvailable && (
                            <Button
                                onClick={onSaveCohort}
                                icon={<UsergroupAddOutlined />}
                                data-attr="person-modal-save-as-cohort"
                            >
                                Save as cohort
                            </Button>
                        )}
                    </>
                )
            }
            width={1500}
            className="person-modal"
        >
            {isInitialLoad ? (
                <div style={{ padding: 16 }}>
                    <Skeleton active />
                </div>
            ) : (
                people && (
                    <>
                        {!preflight?.is_clickhouse_enabled && (
                            <Input.Search
                                allowClear
                                enterButton
                                placeholder="Search for persons by email, name, or ID"
                                onChange={(e) => {
                                    setSearchTerm(e.target.value)
                                    if (!e.target.value) {
                                        setFirstLoadedActors(firstLoadedPeople)
                                    }
                                }}
                                value={searchTerm}
                                onSearch={(term) =>
                                    term
                                        ? setPersonsModalFilters(term, people, filters)
                                        : setFirstLoadedActors(firstLoadedPeople)
                                }
                            />
                        )}
                        <div className="user-count-subheader">
                            <IconPersonFilled style={{ fontSize: '1.125rem', marginRight: '0.5rem' }} />
                            <span>
                                This list contains{' '}
                                <b>
                                    {people.count} unique {aggregationTargetLabel.plural}
                                </b>
                                {peopleParams?.pointValue !== undefined &&
                                    peopleParams.action !== 'session' &&
                                    (!peopleParams.action.math || peopleParams.action.math === 'total') && (
                                        <>
                                            {' '}
                                            who performed the event{' '}
                                            <b>
                                                {peopleParams.pointValue} total{' '}
                                                {pluralize(peopleParams.pointValue, 'time', undefined, false)}
                                            </b>
                                        </>
                                    )}
                                .
                            </span>
                        </div>
                        {people.count > 0 ? (
                            <LemonTable
                                columns={
                                    [
                                        {
                                            title: 'Person',
                                            key: 'person',
                                            render: function Render(_, actor: ActorType) {
                                                return <ActorRow actor={actor} />
                                            },
                                        },
                                    ] as LemonTableColumns<ActorType>
                                }
                                className="persons-table"
                                rowKey="id"
                                embedded
                                showHeader={false}
                                dataSource={people.people}
                                nouns={['person', 'persons']}
                            />
                        ) : (
                            <div className="person-row-container person-row">
                                We couldn't find any matching {aggregationTargetLabel.plural} for this data point.
                            </div>
                        )}
                        {people?.next && (
                            <div
                                style={{
                                    margin: '1rem',
                                    textAlign: 'center',
                                }}
                            >
                                <Button
                                    type="primary"
                                    style={{ color: 'white' }}
                                    onClick={loadMorePeople}
                                    loading={loadingMorePeople}
                                >
                                    Load more {aggregationTargetLabel.plural}
                                </Button>
                            </div>
                        )}
                    </>
                )
            )}
        </Modal>
    )
}

interface ActorRowProps {
    actor: ActorType
}

function getSessionId(event: [Record<string, unknown>]): string {
    return event['$session_id'] ? event['$session_id'] : ``
}

function processArrayInput(event: [], timestamp: any, output: string): ProcessedMessage[] {
    // This function processes the array input when a session ID is present,

    const lastInput = event[event.length - 1]
    const history = event.slice(0, event.length - 1)

    const processedHistory = []

    for (let i = 0; i < history.length; i += 2) {
        const hisCurrent = history[i]

        const processedItem = {
            input: hisCurrent['content'],
            output: history[i + 1]['content'],
            timestamp: hisCurrent['timestamp'],
        }
        processedHistory.push(processedItem)
    }

    return {
        input: lastInput['content'],
        output: output,
        timestamp: timestamp,
        history: processedHistory,
    }
}

type ProcessedMessage = {
    input: string
    output: string
    timestamp: string
    history?: ProcessedMessage[]
}

function processStringInput(event: Record<string, unknown>, allEvents: []): ProcessedMessage[] {
    const msg = {
        input: event['$llm_input'],
        timestamp: event['timestamp'],
        output: event['$llm_output'],
    }

    // find the history of the current event
    const history = allEvents.filter(
        (e) => e['$session_id'] === event['$session_id'] && e['timestamp'] < event['timestamp']
    )

    if (history.length) {
        msg['history'] = history.map((h) => ({
            input: h['$llm_input'],
            output: h['$llm_output'],
            timestamp: h['timestamp'],
        }))
    }

    return msg
}

function addTaskToDialogues(
    dialogues: Record<string, unknown>,
    sessionId: string,
    event: Record<string, unknown>,
    llmEvents: []
): void {
    if (!dialogues[sessionId]) {
        dialogues[sessionId] = []
    }
    let task = null
    if (Array.isArray(event['$llm_input'])) {
        task = processArrayInput(event['$llm_input'], event['timestamp'], event['$llm_output'])
    } else if (typeof event['$llm_input'] === 'string') {
        task = processStringInput(event, llmEvents)
    }
    dialogues[sessionId].push(task)
}

function preProcessEvents(llmEvents: []): Record<string, unknown> {
    /* Preprocess the events to segment them by session ID */
    const segmentedDialogues = {}

    llmEvents.forEach((event: Record<string, unknown>) => {
        const sessionId = getSessionId(event)
        addTaskToDialogues(segmentedDialogues, sessionId, event, llmEvents)
    })

    return segmentedDialogues
}

export function ActorRow({ actor }: ActorRowProps): JSX.Element {
    const [isRowExpanded, setIsRowExpanded] = useState(false)
    const [tab, setTab] = useState('properties')
    const { ['$llm-events']: convs, ...remaining_props } = actor.properties
    let segmentedConvs: { [key: string]: any[] } = {}
    if (convs) {
        segmentedConvs = preProcessEvents(convs, actor.distinct_ids[0])
    }
    if (isGroupType(actor)) {
        return (
            <div key={actor.id} className="person-row">
                <div className="person-ids">
                    <strong>
                        <GroupActorHeader actor={actor} />
                    </strong>
                </div>
            </div>
        )
    } else {
        return (
            <div className="relative border rounded bg-bg-light">
                <div className="flex-center items-center justify-between p-2">
                    <div className="flex-center items-center gap-2">
                        <LemonButton
                            type={isRowExpanded ? 'highlighted' : 'stealth'}
                            onClick={() => setIsRowExpanded((state) => !state)}
                            icon={isRowExpanded ? <IconUnfoldLess /> : <IconUnfoldMore />}
                            title={isRowExpanded ? 'Show less' : 'Show more'}
                            compact
                            className="mr-05"
                        />
                        <strong>
                            <PersonHeader person={actor} withIcon={false} />
                        </strong>
                    </div>
                    <CopyToClipboardInline
                        explicitValue={actor.distinct_ids[0]}
                        iconStyle={{ color: 'var(--primary)' }}
                        iconPosition="end"
                        className="text-small text-muted-alt ml-025"
                    >
                        {midEllipsis(actor.distinct_ids[0], 32)}
                    </CopyToClipboardInline>
                </div>

                {isRowExpanded && (
                    <div className="PersonsModal__tabs bg-side border-t rounded-b">
                        <LemonTabs
                            activeKey={tab}
                            onChange={setTab}
                            tabs={[
                                {
                                    key: 'properties',
                                    label: 'Properties',
                                    content: (
                                        <div>
                                            <PropertiesTable properties={remaining_props} />
                                        </div>
                                    ),
                                },
                                {
                                    key: 'dialogs',
                                    label: 'Dialogs',
                                    content: (
                                        <div>
                                            <div className="pr pl">
                                                <span>{Object.keys(segmentedConvs).length}&nbsp;matched sessions</span>
                                                {Object.entries(segmentedConvs).map(
                                                    ([sessionId, conversation], index) => (
                                                        <ConvRow
                                                            key={index}
                                                            convId={sessionId ? `Session - ${sessionId}` : `Session`}
                                                            conversation={conversation}
                                                            expand={Object.keys(segmentedConvs).length === 1}
                                                            setBorder={index !== Object.keys(segmentedConvs).length - 1} // Don't set border for the last conversation
                                                        />
                                                    )
                                                )}
                                            </div>
                                        </div>
                                    ),
                                },
                            ]}
                        />
                    </div>
                )}
            </div>
        )
    }
}

interface ConvRowProps {
    convId: string
    conversation: { input: string; output: string; timestamp: string; history: [] }[]
    expand: boolean
    setBorder?: boolean
}

export function ConvRow({ convId, conversation, expand, setBorder }: ConvRowProps): JSX.Element {
    const previewText = conversation
        .map((task) => task.input + ' ' + task.output)
        .join(' ')
        .slice(0, 180)

    const [expanded, setExpanded] = useState(expand)
    const handleRowClick = (): void => {
        setExpanded(!expanded)
    }

    return (
        <div className="pt">
            <div
                className="flex-center items-center gap-2 pb"
                onClick={handleRowClick}
                style={{
                    cursor: 'pointer',
                    borderBottom: setBorder && !expanded ? '1px solid rgba(0, 0, 0, 0.15)' : 'none',
                }}
            >
                <LemonButton
                    onClick={() => setExpanded(!expanded)}
                    icon={expanded ? <IconUnfoldLess /> : <IconUnfoldMore />}
                    title={expanded ? 'Show less' : 'Show more'}
                    data-attr={`persons-modal-expand-${convId}`}
                />
                {expanded ? (
                    <div className="flex-1 overflow-hidden ml-075">
                        <strong>{convId}</strong>
                    </div>
                ) : (
                    <div className="flex-1 overflow-hidden ml-075">
                        <strong>{convId}</strong> - {previewText + '...'}
                    </div>
                )}
            </div>
            {expanded && (
                <div className="p-2 font-medium mt-1">
                    {conversation.map((task, i) => (
                        <div key={i} className="mb-05">
                            <Task
                                input={task.input}
                                output={task.output}
                                timestamp={task.timestamp}
                                history={task.history}
                                isTask={true}
                            />
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

interface TaskProps {
    input: string
    output: string
    timestamp?: string
    history?: ProcessedMessage[]
    expandHistory?: boolean
    isTask?: boolean
}

export function Task({ input, output, timestamp, history, expandHistory, isTask }: TaskProps): JSX.Element {
    const backgroundColor_user = 'red'
    const backgroundColor_agent = '#FF5733'
    const [expanded, setExpanded] = useState<boolean>(expandHistory || false)

    const toggleHistory = (): void => {
        setExpanded(!expanded)
    }
    return (
        <div className={isTask ? 'full-border-light' : ''}>
            {timestamp && (
                <div
                    className={`pl ${expanded ? 'border-bottom-light' : ''}`}
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        textAlign: 'left',
                    }}
                >
                    <span className="text-muted-alt">{new Date(timestamp).toLocaleString()}</span>
                    {history && history.length > 0 && (
                        <div onClick={toggleHistory} className="mr" style={{ cursor: 'pointer', color: '#3d57d9' }}>
                            {expanded ? 'Close Chat History' : `Open Chat History (${history.length})`}
                        </div>
                    )}
                </div>
            )}
            <div className="text-small">
                {expanded &&
                    history &&
                    history.map((message, index) => (
                        <Task key={index} input={message.input} output={message.output} isTask={false} />
                    ))}
            </div>
            <div className={`pt ${isTask ? 'border-top-light' : ''}`}>
                <TaskRow
                    role="user"
                    backgroundColor={backgroundColor_user}
                    utterance={input}
                    isTask={isTask}
                    addPaddingBot={true}
                />
                <TaskRow role="agent" backgroundColor={backgroundColor_agent} utterance={output} isTask={isTask} />
            </div>
        </div>
    )
}

interface TaskRowProps {
    role: string
    backgroundColor: string
    utterance: string
    isTask?: boolean // is the row a task or a history message
    addPaddingBot?: boolean
}
export function TaskRow({ role, backgroundColor, utterance, isTask, addPaddingBot }: TaskRowProps): JSX.Element {
    return (
        <div style={{ width: '100%', paddingBottom: addPaddingBot && isTask ? '1rem' : '0' }}>
            <div className="rounded-lg shadow-md p-4">
                <div className={`mb-0.5 rounded-lg p-2`}>
                    <div className="flex flex-row">
                        <div
                            style={{
                                backgroundColor: backgroundColor,
                                borderRadius: '30%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                minWidth: isTask ? '35px' : '25px',
                                padding: '5px',
                                height: isTask ? '35px' : '25px',
                            }}
                        >
                            {role === 'user' ? (
                                <IconPerson style={{ width: '1.5em', height: '1.5em', color: 'white' }} />
                            ) : (
                                <IconRobot style={{ width: '1.5em', height: '1.5em', color: 'white' }} />
                            )}
                        </div>
                        <div className="ml-075 mr-075">
                            <MessageRender>{utterance}</MessageRender>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
