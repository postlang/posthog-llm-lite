import { useActions, useValues } from 'kea'
import { IconPlus } from 'lib/components/icons'
import { LemonButton } from 'lib/components/LemonButton'
import { LemonRow, LemonSpacer } from 'lib/components/LemonRow'
import { LemonTag } from 'lib/components/LemonTag/LemonTag'
import { Lettermark } from 'lib/components/Lettermark/Lettermark'
import { membershipLevelToName } from 'lib/utils/permissioning'
import React from 'react'
import { organizationLogic } from 'scenes/organizationLogic'
import { preflightLogic } from 'scenes/PreflightCheck/logic'
import { userLogic } from 'scenes/userLogic'
import { OrganizationBasicType } from '~/types'
import { navigationLogic } from './navigationLogic'

export function AccessLevelIndicator({ organization }: { organization: OrganizationBasicType }): JSX.Element {
    return (
        <LemonTag className="AccessLevelIndicator" title={`Your ${organization.name} organization access level`}>
            {(organization.membership_level ? membershipLevelToName.get(organization.membership_level) : null) || '?'}
        </LemonTag>
    )
}

export function OtherOrganizationButton({ organization }: { organization: OrganizationBasicType }): JSX.Element {
    const { updateCurrentOrganization } = useActions(userLogic)

    return (
        <LemonButton
            onClick={() => updateCurrentOrganization(organization.id)}
            icon={<Lettermark name={organization.name} />}
            className="SitePopover__organization"
            type="stealth"
            title={`Switch to organization ${organization.name}`}
            fullWidth
        >
            {organization.name}
            <AccessLevelIndicator organization={organization} />
        </LemonButton>
    )
}

export function NewOrganizationButton(): JSX.Element {
    const { showCreateOrganizationModal } = useActions(navigationLogic)

    return (
        <LemonButton icon={<IconPlus />} onClick={() => showCreateOrganizationModal()} fullWidth>
            New organization
        </LemonButton>
    )
}

export function OrganizationSwitcherOverlay(): JSX.Element {
    const { preflight } = useValues(preflightLogic)
    const { otherOrganizations } = useValues(userLogic)
    const { currentOrganization } = useValues(organizationLogic)
    return (
        <div>
            <h5>Organizations</h5>
            <LemonSpacer />
            {currentOrganization && (
                <LemonRow status="highlighted" fullWidth icon={<Lettermark name={currentOrganization.name} />}>
                    <div className="SitePopover__main-info SitePopover__organization">
                        <strong>{currentOrganization.name}</strong>
                        <AccessLevelIndicator organization={currentOrganization} />
                    </div>
                </LemonRow>
            )}
            {otherOrganizations.map((otherOrganization) => (
                <OtherOrganizationButton key={otherOrganization.id} organization={otherOrganization} />
            ))}
            {preflight?.can_create_org && <NewOrganizationButton />}
        </div>
    )
}
