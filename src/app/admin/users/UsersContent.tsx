// Created: 2026-01-27 17:10:00
// Updated: 2026-01-29 - Server Actions 연동, Auth 통합
// Updated: 2026-02-10 - 닉네임 필드 추가, 그룹 관리 기능 추가
'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  createUserAction,
  updateUserAction,
  deleteUserAction,
  resetPasswordAction,
  createGroupAction,
  updateGroupAction,
  deleteGroupAction,
  updateUserGroupsAction,
} from './actions'

interface User {
  id: string
  username: string
  role: 'admin' | 'manager'
  name: string
  nickname: string | null
  created_at: string
}

interface Group {
  id: string
  name: string
  created_at: string
}

interface UserGroup {
  user_id: string
  group_id: string
}

interface UsersContentProps {
  users: User[]
  groups: Group[]
  userGroups: UserGroup[]
}

export default function UsersContent({
  users: initialUsers,
  groups: initialGroups,
  userGroups: initialUserGroups,
}: UsersContentProps) {
  const [users, setUsers] = useState<User[]>(initialUsers)
  const [groups, setGroups] = useState<Group[]>(initialGroups)
  const [userGroups, setUserGroups] = useState<UserGroup[]>(initialUserGroups)
  const [showModal, setShowModal] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [passwordResetUser, setPasswordResetUser] = useState<User | null>(null)
  const [formData, setFormData] = useState({
    password: '',
    username: '',
    name: '',
    nickname: '',
    role: 'manager' as 'admin' | 'manager',
  })
  const [newPassword, setNewPassword] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterRole, setFilterRole] = useState<'all' | 'admin' | 'manager'>('all')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 그룹 관리 상태
  const [showGroupModal, setShowGroupModal] = useState(false)
  const [editingGroup, setEditingGroup] = useState<Group | null>(null)
  const [groupName, setGroupName] = useState('')

  // 그룹 할당 상태
  const [showGroupAssignModal, setShowGroupAssignModal] = useState(false)
  const [selectedUserForGroups, setSelectedUserForGroups] = useState<User | null>(null)
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([])

  // 필터링된 사용자 목록
  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.nickname && user.nickname.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesRole = filterRole === 'all' || user.role === filterRole
    return matchesSearch && matchesRole
  })

  // 모달 열기 (추가)
  const openAddModal = () => {
    setEditingUser(null)
    setFormData({ password: '', username: '', name: '', nickname: '', role: 'manager' })
    setError(null)
    setShowModal(true)
  }

  // 모달 열기 (수정)
  const openEditModal = (user: User) => {
    setEditingUser(user)
    setFormData({
      password: '',
      username: user.username,
      name: user.name,
      nickname: user.nickname || '',
      role: user.role,
    })
    setError(null)
    setShowModal(true)
  }

  // 모달 닫기
  const closeModal = () => {
    setShowModal(false)
    setEditingUser(null)
    setFormData({ password: '', username: '', name: '', nickname: '', role: 'manager' })
    setError(null)
  }

  // 비밀번호 재설정 모달 열기
  const openPasswordModal = (user: User) => {
    setPasswordResetUser(user)
    setNewPassword('')
    setError(null)
    setShowPasswordModal(true)
  }

  // 비밀번호 재설정 모달 닫기
  const closePasswordModal = () => {
    setShowPasswordModal(false)
    setPasswordResetUser(null)
    setNewPassword('')
    setError(null)
  }

  // 그룹 모달 열기 (추가)
  const openAddGroupModal = () => {
    setEditingGroup(null)
    setGroupName('')
    setError(null)
    setShowGroupModal(true)
  }

  // 그룹 모달 열기 (수정)
  const openEditGroupModal = (group: Group) => {
    setEditingGroup(group)
    setGroupName(group.name)
    setError(null)
    setShowGroupModal(true)
  }

  // 그룹 모달 닫기
  const closeGroupModal = () => {
    setShowGroupModal(false)
    setEditingGroup(null)
    setGroupName('')
    setError(null)
  }

  // 그룹 할당 모달 열기
  const openGroupAssignModal = (user: User) => {
    setSelectedUserForGroups(user)
    const currentGroupIds = userGroups
      .filter((ug) => ug.user_id === user.id)
      .map((ug) => ug.group_id)
    setSelectedGroupIds(currentGroupIds)
    setError(null)
    setShowGroupAssignModal(true)
  }

  // 그룹 할당 모달 닫기
  const closeGroupAssignModal = () => {
    setShowGroupAssignModal(false)
    setSelectedUserForGroups(null)
    setSelectedGroupIds([])
    setError(null)
  }

  // 폼 제출 - Server Actions 사용
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      if (editingUser) {
        // 수정
        const result = await updateUserAction({
          userId: editingUser.id,
          username: formData.username,
          name: formData.name,
          nickname: formData.nickname || undefined,
          role: formData.role,
        })

        if (!result.success) {
          throw new Error(result.error)
        }

        setUsers(users.map((u) =>
          u.id === editingUser.id
            ? {
                ...u,
                username: formData.username,
                name: formData.name,
                nickname: formData.nickname || null,
                role: formData.role,
              }
            : u
        ))
      } else {
        // 추가 - Auth와 함께 사용자 생성
        if (!formData.username || !formData.password) {
          throw new Error('아이디와 비밀번호는 필수입니다.')
        }

        if (formData.password.length < 6) {
          throw new Error('비밀번호는 6자 이상이어야 합니다.')
        }

        const email = `${formData.username}@ttting.com`

        const result = await createUserAction({
          email,
          password: formData.password,
          username: formData.username,
          name: formData.name,
          nickname: formData.nickname || undefined,
          role: formData.role,
        })

        if (!result.success) {
          throw new Error(result.error)
        }

        // 새 사용자 추가
        setUsers([{
          id: result.userId!,
          username: formData.username,
          name: formData.name,
          nickname: formData.nickname || null,
          role: formData.role,
          created_at: new Date().toISOString(),
        }, ...users])
      }

      closeModal()
    } catch (err: any) {
      console.error('Error saving user:', err)
      setError(err.message || '저장 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  // 비밀번호 재설정
  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!passwordResetUser) return

    setIsLoading(true)
    setError(null)

    try {
      if (newPassword.length < 6) {
        throw new Error('비밀번호는 6자 이상이어야 합니다.')
      }

      const result = await resetPasswordAction(passwordResetUser.id, newPassword)

      if (!result.success) {
        throw new Error(result.error)
      }

      alert('비밀번호가 재설정되었습니다.')
      closePasswordModal()
    } catch (err: any) {
      console.error('Error resetting password:', err)
      setError(err.message || '비밀번호 재설정 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  // 삭제 - Server Action 사용 (Auth와 DB 모두 삭제)
  const handleDelete = async (userId: string) => {
    if (!confirm('정말 삭제하시겠습니까? Auth 계정도 함께 삭제됩니다.')) return

    setIsLoading(true)
    try {
      const result = await deleteUserAction(userId)

      if (!result.success) {
        throw new Error(result.error)
      }

      setUsers(users.filter((u) => u.id !== userId))
      setUserGroups(userGroups.filter((ug) => ug.user_id !== userId))
    } catch (err: any) {
      console.error('Error deleting user:', err)
      alert(err.message || '삭제 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  // 그룹 생성/수정 핸들러
  const handleGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!groupName.trim()) return

    setIsLoading(true)
    setError(null)

    try {
      if (editingGroup) {
        const result = await updateGroupAction(editingGroup.id, groupName.trim())
        if (!result.success) {
          throw new Error(result.error)
        }
        setGroups(groups.map((g) =>
          g.id === editingGroup.id ? { ...g, name: groupName.trim() } : g
        ))
      } else {
        const result = await createGroupAction(groupName.trim())
        if (!result.success) {
          throw new Error(result.error)
        }
        if (result.data) {
          setGroups([...groups, result.data])
        }
      }
      closeGroupModal()
    } catch (err: any) {
      console.error('Error saving group:', err)
      setError(err.message || '그룹 저장 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  // 그룹 삭제 핸들러
  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm('정말 이 그룹을 삭제하시겠습니까? 사용자-그룹 연결도 함께 삭제됩니다.')) return

    setIsLoading(true)
    try {
      const result = await deleteGroupAction(groupId)
      if (!result.success) {
        throw new Error(result.error)
      }
      setGroups(groups.filter((g) => g.id !== groupId))
      setUserGroups(userGroups.filter((ug) => ug.group_id !== groupId))
    } catch (err: any) {
      console.error('Error deleting group:', err)
      alert(err.message || '그룹 삭제 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  // 그룹 할당 저장 핸들러
  const handleSaveGroupAssignment = async () => {
    if (!selectedUserForGroups) return

    setIsLoading(true)
    setError(null)

    try {
      const result = await updateUserGroupsAction(selectedUserForGroups.id, selectedGroupIds)
      if (!result.success) {
        throw new Error(result.error)
      }

      // 로컬 상태 업데이트
      const newUserGroups = userGroups.filter((ug) => ug.user_id !== selectedUserForGroups.id)
      const additions = selectedGroupIds.map((gid) => ({
        user_id: selectedUserForGroups.id,
        group_id: gid,
      }))
      setUserGroups([...newUserGroups, ...additions])

      closeGroupAssignModal()
    } catch (err: any) {
      console.error('Error saving group assignment:', err)
      setError(err.message || '그룹 할당 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  // 그룹 체크박스 토글
  const toggleGroupId = (groupId: string) => {
    setSelectedGroupIds((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId]
    )
  }

  // 사용자의 그룹 이름 목록 가져오기
  const getUserGroupNames = (userId: string): string[] => {
    const gids = userGroups.filter((ug) => ug.user_id === userId).map((ug) => ug.group_id)
    return groups.filter((g) => gids.includes(g.id)).map((g) => g.name)
  }

  // 역할 라벨
  const getRoleLabel = (role: string) => {
    return role === 'admin' ? '관리자' : '매니저'
  }

  // 역할 배지 색상
  const getRoleBadgeClass = (role: string) => {
    return role === 'admin'
      ? 'bg-purple-100 text-purple-800'
      : 'bg-blue-100 text-blue-800'
  }

  // 날짜 포맷
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Link href="/admin" className="hover:text-primary-600">
              대시보드
            </Link>
            <span>/</span>
            <span>사용자 관리</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">사용자 관리</h1>
          <p className="mt-1 text-gray-600">
            총 {users.length}명의 사용자가 등록되어 있습니다.
          </p>
        </div>
        <button
          onClick={openAddModal}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          새 사용자 추가
        </button>
      </div>

      {/* 그룹 관리 섹션 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">그룹 관리</h2>
          <button
            onClick={openAddGroupModal}
            disabled={isLoading}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            그룹 추가
          </button>
        </div>
        {groups.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {groups.map((group) => (
              <div
                key={group.id}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-sm"
              >
                <span>{group.name}</span>
                <button
                  onClick={() => openEditGroupModal(group)}
                  className="p-0.5 text-gray-400 hover:text-primary-600 transition-colors"
                  title="수정"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDeleteGroup(group.id)}
                  className="p-0.5 text-gray-400 hover:text-red-600 transition-colors"
                  title="삭제"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">등록된 그룹이 없습니다.</p>
        )}
      </div>

      {/* 필터 및 검색 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* 검색 */}
          <div className="flex-1">
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                placeholder="이름, 아이디 또는 닉네임으로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>

          {/* 역할 필터 */}
          <div className="flex gap-2">
            {(['all', 'admin', 'manager'] as const).map((role) => (
              <button
                key={role}
                onClick={() => setFilterRole(role)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filterRole === role
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {role === 'all' ? '전체' : getRoleLabel(role)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 사용자 테이블 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  사용자
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  아이디
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  닉네임
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  역할
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  그룹
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  가입일
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  관리
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-gray-600 font-medium">
                          {user.name.charAt(0)}
                        </div>
                        <div className="ml-3">
                          <p className="font-medium text-gray-900">{user.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                      {user.username}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                      {user.nickname || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getRoleBadgeClass(
                          user.role
                        )}`}
                      >
                        {getRoleLabel(user.role)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {(() => {
                        const groupNames = getUserGroupNames(user.id)
                        return groupNames.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {groupNames.map((gn, i) => (
                              <span
                                key={i}
                                className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-800"
                              >
                                {gn}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
                        )
                      })()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                      {formatDate(user.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        {user.role === 'manager' && (
                          <button
                            onClick={() => openGroupAssignModal(user)}
                            disabled={isLoading}
                            className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                            title="그룹 할당"
                          >
                            <svg
                              className="w-5 h-5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                              />
                            </svg>
                          </button>
                        )}
                        <button
                          onClick={() => openEditModal(user)}
                          disabled={isLoading}
                          className="p-2 text-gray-600 hover:text-primary-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                          title="수정"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={() => openPasswordModal(user)}
                          disabled={isLoading}
                          className="p-2 text-gray-600 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors disabled:opacity-50"
                          title="비밀번호 재설정"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(user.id)}
                          disabled={isLoading}
                          className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                          title="삭제"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    {searchTerm || filterRole !== 'all'
                      ? '검색 결과가 없습니다.'
                      : '등록된 사용자가 없습니다.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 추가/수정 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingUser ? '사용자 수정' : '새 사용자 추가'}
              </h2>
              <button
                onClick={closeModal}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  아이디 (로그인용) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) =>
                    setFormData({ ...formData, username: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="영문, 한글 등 자유 입력"
                  required
                />
                {!editingUser && (
                  <p className="mt-1 text-xs text-gray-500">이 아이디로 로그인합니다</p>
                )}
              </div>

              {/* 새 사용자 추가 시에만 비밀번호 표시 */}
              {!editingUser && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    비밀번호 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="6자 이상"
                    minLength={6}
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  이름
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="사용자 이름"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  닉네임
                </label>
                <input
                  type="text"
                  value={formData.nickname}
                  onChange={(e) =>
                    setFormData({ ...formData, nickname: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="닉네임 (선택)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  역할
                </label>
                <select
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      role: e.target.value as 'admin' | 'manager',
                    })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="manager">매니저</option>
                  <option value="admin">관리자</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
                >
                  {isLoading ? '저장 중...' : editingUser ? '수정' : '추가'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 비밀번호 재설정 모달 */}
      {showPasswordModal && passwordResetUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                비밀번호 재설정
              </h2>
              <button
                onClick={closePasswordModal}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <form onSubmit={handlePasswordReset} className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-700">
                  <strong>{passwordResetUser.name}</strong> ({passwordResetUser.username})님의 비밀번호를 재설정합니다.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  새 비밀번호 <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="6자 이상"
                  minLength={6}
                  required
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closePasswordModal}
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors disabled:opacity-50"
                >
                  {isLoading ? '재설정 중...' : '비밀번호 재설정'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 그룹 추가/수정 모달 */}
      {showGroupModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full mx-4">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingGroup ? '그룹 수정' : '새 그룹 추가'}
              </h2>
              <button
                onClick={closeGroupModal}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <form onSubmit={handleGroupSubmit} className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  그룹 이름 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="그룹 이름"
                  required
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeGroupModal}
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {isLoading ? '저장 중...' : editingGroup ? '수정' : '추가'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 그룹 할당 모달 */}
      {showGroupAssignModal && selectedUserForGroups && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full mx-4">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                그룹 할당
              </h2>
              <button
                onClick={closeGroupAssignModal}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-700">
                  <strong>{selectedUserForGroups.name}</strong> ({selectedUserForGroups.username})님의 그룹을 설정합니다.
                </p>
              </div>

              {groups.length > 0 ? (
                <div className="space-y-2">
                  {groups.map((group) => (
                    <label
                      key={group.id}
                      className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedGroupIds.includes(group.id)}
                        onChange={() => toggleGroupId(group.id)}
                        className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                      />
                      <span className="text-sm text-gray-700">{group.name}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-4">
                  등록된 그룹이 없습니다. 먼저 그룹을 추가해주세요.
                </p>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeGroupAssignModal}
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleSaveGroupAssignment}
                  disabled={isLoading || groups.length === 0}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
                >
                  {isLoading ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
